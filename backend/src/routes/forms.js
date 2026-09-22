import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware.js';
import { formOut } from '../serialize.js';

export const formsRouter = Router();

function nextPlNum(pacId) {
  const rows = db.prepare('SELECT pl_num FROM forms WHERE pac_id = ?').all(pacId);
  return Math.max(0, ...rows.map(r => r.pl_num || 0)) + 1;
}

function validatePayload(body) {
  const { title, location, schedule, days, times, due, params } = body || {};
  if (!title || !String(title).trim()) return 'Informe o título do documento.';
  if (!Array.isArray(params) || !params.length || params.some(p => !p.name || !String(p.name).trim())) return 'Todo parâmetro precisa de um nome.';
  if (schedule && schedule.type === 'fixos' && (!times || !times.length)) return 'Adicione ao menos um horário.';
  if (schedule && schedule.type === 'momentos' && (!schedule.moments || !schedule.moments.length)) return 'Selecione ao menos um momento.';
  return null;
}

formsRouter.post('/', authenticate, requireRole('gerente'), (req, res) => {
  const err = validatePayload(req.body);
  if (err) return res.status(400).json({ error: err });
  const { pacId, title, location, schedule, days, times, due, params, sector } = req.body;
  const pac = db.prepare('SELECT * FROM pacs WHERE id = ?').get(pacId);
  if (!pac) return res.status(404).json({ error: 'PAC não encontrado.' });

  const id = 'f' + Date.now() + Math.random().toString(36).slice(2, 7);
  const plNum = nextPlNum(pacId);
  const revDate = new Date().toISOString();
  const paramsWithIds = params.map(p => ({ ...p, id: p.id || 'p' + Date.now() + Math.random().toString(36).slice(2, 6) }));

  db.prepare(`INSERT INTO forms (id,pac_id,pl_num,rev,rev_date,title,due,schedule_json,days_json,times_json,location,sector,default_status,params_json,operator_id)
    VALUES (?,?,?,1,?,?,?,?,?,?,?,?,?,?,NULL)`)
    .run(id, pacId, plNum, revDate, title.trim(), due || '', JSON.stringify(schedule || null), JSON.stringify(days || []), JSON.stringify(times || []),
      (location || 'A definir').trim(), sector || 'Definido', 'afazer', JSON.stringify(paramsWithIds));

  res.status(201).json({ form: formOut(db.prepare('SELECT * FROM forms WHERE id = ?').get(id)) });
});

// "Salvar e Publicar" cria uma nova revisão: a versão vigente anterior é arquivada
// em form_revisions (auditável), nunca sobrescrita silenciosamente.
formsRouter.put('/:id', authenticate, requireRole('gerente'), (req, res) => {
  const existing = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Planilha não encontrada.' });
  const err = validatePayload(req.body);
  if (err) return res.status(400).json({ error: err });
  const { title, location, schedule, days, times, due, params, sector } = req.body;

  db.prepare('INSERT INTO form_revisions (form_id, rev, snapshot_json, archived_at) VALUES (?,?,?,?)')
    .run(existing.id, existing.rev, JSON.stringify(existing), new Date().toISOString());

  const paramsWithIds = params.map(p => ({ ...p, id: p.id || 'p' + Date.now() + Math.random().toString(36).slice(2, 6) }));
  const newRev = (existing.rev || 1) + 1;
  db.prepare(`UPDATE forms SET title=?, due=?, schedule_json=?, days_json=?, times_json=?, location=?, sector=?, params_json=?, rev=?, rev_date=? WHERE id=?`)
    .run(title.trim(), due || '', JSON.stringify(schedule || null), JSON.stringify(days || []), JSON.stringify(times || []),
      (location || existing.location).trim(), sector || existing.sector, JSON.stringify(paramsWithIds), newRev, new Date().toISOString(), existing.id);

  res.json({ form: formOut(db.prepare('SELECT * FROM forms WHERE id = ?').get(existing.id)) });
});
