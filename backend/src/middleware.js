import { db } from './db.js';
import { verifyToken } from './auth.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  let payload;
  try { payload = verifyToken(token); }
  catch (e) { return res.status(401).json({ error: 'Sessão inválida ou expirada.' }); }
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.sub);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' });
    }
    next();
  };
}

export function requireTitular(req, res, next) {
  if (!req.user || !req.user.titular) return res.status(403).json({ error: 'Somente o titular/RT pode executar esta ação.' });
  next();
}
