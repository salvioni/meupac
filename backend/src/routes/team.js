import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware.js';
import { teamMemberOut, formOut } from '../serialize.js';

export const teamRouter = Router();

function canManage(actor, target) {
  if (!target || target.id === actor.id) return false;
  if (target.titular) return false;
  if (target.role === 'operador') return actor.role === 'gerente';
  return !!actor.titular; // outro gestor: só o titular mexe
}

teamRouter.get('/', authenticate, requireRole('gerente'), (req, res) => {
  const users = db.prepare('SELECT * FROM users WHERE active = 1').all();
  const forms = db.prepare('SELECT id, operator_id FROM forms').all();
  const team = users.map(u => ({
    ...teamMemberOut(u),
    ownedFormIds: forms.filter(f => f.operator_id === u.id).map(f => f.id),
    canManage: canManage(req.user, u),
  }));
  res.json({ team });
});

teamRouter.post('/', authenticate, requireRole('gerente'), (req, res) => {
  const { name, username, role } = req.body || {};
  if (!name || !username) return res.status(400).json({ error: 'Informe nome e usuário.' });
  const uname = String(username).toLowerCase().trim();
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
    return res.status(409).json({ error: 'Já existe um usuário com esse login.' });
  }
  const id = 'u' + Date.now() + Math.random().toString(36).slice(2, 6);
  const tempPassword = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 4).toUpperCase();
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  db.prepare(`INSERT INTO users (id,name,username,password_hash,role,titular,initials,color,ink,active) VALUES (?,?,?,?,?,0,?,?,?,1)`)
    .run(id, name.trim(), uname, bcrypt.hashSync(tempPassword, 10), role === 'gerente' ? 'gerente' : 'operador', initials, '#dfe9fb', '#0f2642');
  res.status(201).json({ member: teamMemberOut(db.prepare('SELECT * FROM users WHERE id = ?').get(id)), tempPassword });
});

teamRouter.put('/:id', authenticate, requireRole('gerente'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Colaborador não encontrado.' });
  if (!canManage(req.user, target)) return res.status(403).json({ error: 'Você não pode editar este colaborador.' });

  const { role, ownedFormIds } = req.body || {};
  const newRole = role === 'gerente' ? 'gerente' : 'operador';
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, target.id);

  if (newRole === 'operador' && Array.isArray(ownedFormIds)) {
    const owned = new Set(ownedFormIds);
    const allForms = db.prepare('SELECT id, operator_id FROM forms').all();
    const setOwner = db.prepare('UPDATE forms SET operator_id = ? WHERE id = ?');
    allForms.forEach(f => {
      const mine = f.operator_id === target.id;
      if (owned.has(f.id)) setOwner.run(target.id, f.id);
      else if (mine) setOwner.run(null, f.id);
    });
  }
  res.json({ member: teamMemberOut(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)) });
});

// "Excluir" desativa a conta (perde acesso) sem apagar o histórico assinado em seu nome —
// apagar de verdade quebraria a trilha de auditoria de registros já assinados.
teamRouter.delete('/:id', authenticate, requireRole('gerente'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Colaborador não encontrado.' });
  if (!canManage(req.user, target)) return res.status(403).json({ error: 'Você não pode remover este colaborador.' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(target.id);
  db.prepare('UPDATE forms SET operator_id = NULL WHERE operator_id = ?').run(target.id);
  res.json({ ok: true });
});
