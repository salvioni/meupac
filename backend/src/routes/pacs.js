import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware.js';
import { pacOut } from '../serialize.js';

export const pacsRouter = Router();

pacsRouter.put('/:id/active', authenticate, requireRole('gerente'), (req, res) => {
  const pac = db.prepare('SELECT * FROM pacs WHERE id = ?').get(req.params.id);
  if (!pac) return res.status(404).json({ error: 'PAC não encontrado.' });
  const active = req.body && typeof req.body.active === 'boolean' ? req.body.active : !pac.active;
  db.prepare('UPDATE pacs SET active = ? WHERE id = ?').run(active ? 1 : 0, pac.id);
  res.json({ pac: pacOut(db.prepare('SELECT * FROM pacs WHERE id = ?').get(pac.id)) });
});
