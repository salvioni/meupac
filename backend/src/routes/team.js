import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware.js';
import { teamMemberOut } from '../serialize.js';

export const teamRouter = Router();

function canManage(actor, target) {
  if (!target || target.id === actor.id) return false;
  if (target.titular) return false;
  if (target.unidade_id !== actor.unidade_id) return false;
  if (target.role === 'operador') return actor.role === 'gerente';
  return !!actor.titular; // outro gestor: só o titular mexe
}

teamRouter.get('/', authenticate, requireRole('gerente'), (req, res) => {
  const users = db.prepare('SELECT * FROM users WHERE active = 1 AND unidade_id = ?').all(req.user.unidade_id);
  const formOps = db.prepare(`
    SELECT fo.form_id, fo.operator_id FROM form_operators fo
    JOIN forms f ON f.id = fo.form_id
    WHERE f.unidade_id = ?
  `).all(req.user.unidade_id);
  const team = users.map(u => ({
    ...teamMemberOut(u),
    ownedFormIds: formOps.filter(r => r.operator_id === u.id).map(r => r.form_id),
    canManage: canManage(req.user, u),
  }));
  res.json({ team });
});

teamRouter.post('/', authenticate, requireRole('gerente'), (req, res) => {
  const { name, username, role } = req.body || {};
  if (!name || !username) return res.status(400).json({ error: 'Informe nome e usuário.' });
  const wantsGerente = role === 'gerente';
  // só o titular cria outros gestores — um gestor comum criando outro seria
  // escalação de privilégio (o próprio canManage já proíbe isso pra contas existentes)
  if (wantsGerente && !req.user.titular) {
    return res.status(403).json({ error: 'Somente o titular pode criar contas de gestor.' });
  }
  const uname = String(username).toLowerCase().trim();
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
    return res.status(409).json({ error: 'Já existe um usuário com esse login.' });
  }
  const id = 'u' + Date.now() + Math.random().toString(36).slice(2, 6);
  const tempPassword = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 4).toUpperCase();
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  db.prepare(`INSERT INTO users (id,unidade_id,name,username,password_hash,role,titular,initials,color,ink,active) VALUES (?,?,?,?,?,?,0,?,?,?,1)`)
    .run(id, req.user.unidade_id, name.trim(), uname, bcrypt.hashSync(tempPassword, 10), wantsGerente ? 'gerente' : 'operador', initials, '#dfe9fb', '#0f2642');
  res.status(201).json({ member: teamMemberOut(db.prepare('SELECT * FROM users WHERE id = ?').get(id)), tempPassword });
});

teamRouter.put('/:id', authenticate, requireRole('gerente'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1 AND unidade_id = ?').get(req.params.id, req.user.unidade_id);
  if (!target) return res.status(404).json({ error: 'Colaborador não encontrado.' });
  if (!canManage(req.user, target)) return res.status(403).json({ error: 'Você não pode editar este colaborador.' });

  const { role, ownedFormIds } = req.body || {};
  const newRole = role === 'gerente' ? 'gerente' : 'operador';
  // promover alguém a gestor é uma escalação de privilégio — só o titular decide isso,
  // mesmo que o ator já pudesse editar esse colaborador enquanto operador
  if (newRole === 'gerente' && target.role !== 'gerente' && !req.user.titular) {
    return res.status(403).json({ error: 'Somente o titular pode promover alguém a gestor.' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, target.id);

  if (newRole === 'operador' && Array.isArray(ownedFormIds)) {
    const validFormIds = new Set(db.prepare('SELECT id FROM forms WHERE unidade_id = ?').all(req.user.unidade_id).map(r => r.id));
    const owned = new Set(ownedFormIds.filter(id => validFormIds.has(id)));
    const current = new Set(db.prepare('SELECT form_id FROM form_operators WHERE operator_id = ?').all(target.id).map(r => r.form_id));
    const insOp = db.prepare('INSERT OR IGNORE INTO form_operators (form_id, operator_id) VALUES (?, ?)');
    const delOp = db.prepare('DELETE FROM form_operators WHERE form_id = ? AND operator_id = ?');
    owned.forEach(id => { if (!current.has(id)) insOp.run(id, target.id); });
    current.forEach(id => { if (!owned.has(id)) delOp.run(id, target.id); });
  }
  res.json({ member: teamMemberOut(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)) });
});

// gera uma nova senha temporária pra outro colaborador — é assim que "esqueci minha
// senha" se resolve nesse app: não tem e-mail configurado pra reset self-service,
// então quem redefine é sempre um gestor/titular autorizado a mexer na conta.
teamRouter.post('/:id/reset-password', authenticate, requireRole('gerente'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1 AND unidade_id = ?').get(req.params.id, req.user.unidade_id);
  if (!target) return res.status(404).json({ error: 'Colaborador não encontrado.' });
  if (!canManage(req.user, target)) return res.status(403).json({ error: 'Você não pode redefinir a senha deste colaborador.' });
  const tempPassword = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 4).toUpperCase();
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(tempPassword, 10), target.id);
  res.json({ ok: true, tempPassword });
});

// "Excluir" desativa a conta (perde acesso) sem apagar o histórico assinado em seu nome —
// apagar de verdade quebraria a trilha de auditoria de registros já assinados.
teamRouter.delete('/:id', authenticate, requireRole('gerente'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1 AND unidade_id = ?').get(req.params.id, req.user.unidade_id);
  if (!target) return res.status(404).json({ error: 'Colaborador não encontrado.' });
  if (!canManage(req.user, target)) return res.status(403).json({ error: 'Você não pode remover este colaborador.' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(target.id);
  db.prepare('DELETE FROM form_operators WHERE operator_id = ?').run(target.id);
  res.json({ ok: true });
});
