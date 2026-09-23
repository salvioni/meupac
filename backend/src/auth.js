import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

// nunca usar um segredo fixo/conhecido como fallback: quem soubesse essa string
// conseguiria forjar um token válido pra qualquer usuário (inclusive o titular).
// Em produção, exige a variável de ambiente; fora dela, gera um segredo aleatório
// só pra essa execução (sessões antigas caem ao reiniciar — mal menor pro dev local).
function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('[meupac] JWT_SECRET não definido em produção. Encerrando.');
    process.exit(1);
  }
  console.warn('[meupac] JWT_SECRET não definido — usando um segredo aleatório gerado nesta execução (sessões não sobrevivem a um restart). Defina JWT_SECRET em produção.');
  return randomBytes(32).toString('hex');
}
const JWT_SECRET = resolveSecret();

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
