import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, seedPacsFor } from '../db.js';
import { signToken, publicUser } from '../auth.js';
import { authenticate } from '../middleware.js';

export const authRouter = Router();

// cria uma unidade (empresa) nova com seu próprio titular/RT — cada cadastro é um
// tenant isolado do zero, com seus próprios 15 PACs, sem enxergar dado de ninguém.
authRouter.post('/signup', (req, res) => {
  const { razaoSocial, cnpj, sif, endereco, municipio, rtRegistro, adminName, username, password } = req.body || {};
  if (!razaoSocial || !String(razaoSocial).trim()) return res.status(400).json({ error: 'Informe o nome da empresa/unidade.' });
  if (!adminName || !String(adminName).trim()) return res.status(400).json({ error: 'Informe seu nome.' });
  if (!username || !String(username).trim()) return res.status(400).json({ error: 'Escolha um usuário de login.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });

  const uname = String(username).toLowerCase().trim();
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
    return res.status(409).json({ error: 'Já existe um usuário com esse login.' });
  }

  const unidadeId = 'un' + Date.now() + Math.random().toString(36).slice(2, 7);
  db.prepare(`INSERT INTO unidade (id,razao_social,marca,cnpj,sif,endereco,municipio,rt_nome,rt_registro,logo) VALUES (?,?,?,?,?,?,?,?,?,NULL)`)
    .run(unidadeId, razaoSocial.trim(), '', String(cnpj || '').trim(), String(sif || '').trim(), String(endereco || '').trim(), String(municipio || '').trim(), adminName.trim(), String(rtRegistro || '').trim());

  seedPacsFor(unidadeId);

  const userId = 'u' + Date.now() + Math.random().toString(36).slice(2, 6);
  const initials = adminName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  db.prepare(`INSERT INTO users (id,unidade_id,name,username,password_hash,role,titular,initials,color,ink,active) VALUES (?,?,?,?,?,'gerente',1,?,?,?,1)`)
    .run(userId, unidadeId, adminName.trim(), uname, bcrypt.hashSync(password, 10), initials, '#0f2642', '#ffffff');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Informe usuário e senha.' });
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

authRouter.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Informe a senha atual e uma nova senha com pelo menos 6 caracteres.' });
  }
  if (!bcrypt.compareSync(currentPassword, req.user.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});
