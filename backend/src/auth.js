import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me-in-production';
if (!process.env.JWT_SECRET) {
  console.warn('[meupac] JWT_SECRET não definido — usando segredo de desenvolvimento. Defina JWT_SECRET em produção.');
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, titular: !!user.titular }, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, username: row.username, role: row.role,
    titular: !!row.titular, cargo: row.cargo, turno: row.turno, matricula: row.matricula,
    initials: row.initials, color: row.color, ink: row.ink,
  };
}
