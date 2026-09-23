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
  if (schedule && schedule.type === 'fixos' && !schedule.semHorario && (!times || !times.length)) return 'Adicione ao menos um horário.';
  if (schedule && schedule.type === 'momentos' && (!schedule.moments || !schedule.moments.length)) return 'Selecione ao menos um momento.';
  return null;
}

formsRouter.post('/', authenticate, requireRole('gerente'), (req, res) => {
  const err = validatePayload(req.body);
  if (err) return res.status(400).json({ error: err });
  const { pacId, title, location, schedule, days, times, due, params, sector, toleranceMin } = req.body;
  const pac = db.prepare('SELECT * FROM pacs WHERE id = ? AND unidade_id = ?').get(pacId, req.user.unidade_id);
  if (!pac) return res.status(404).json({ error: 'PAC não encontrado.' });

  const id = 'f' + Date.now() + Math.random().toString(36).slice(2, 7);
  const plNum = nextPlNum(pacId);
  const revDate = new Date().toISOString();
  const paramsWithIds = params.map(p => ({ ...p, id: p.id || 'p' + Date.now() + Math.random().toString(36).slice(2, 6) }));

  db.prepare(`INSERT INTO forms (id,unidade_id,pac_id,pl_num,rev,rev_date,title,due,schedule_json,days_json,times_json,location,sector,default_status,params_json,operator_id,tolerance_min)
    VALUES (?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,NULL,?)`)
    .run(id, req.user.unidade_id, pacId, plNum, revDate, title.trim(), due || '', JSON.stringify(schedule || null), JSON.stringify(days || []), JSON.stringify(times || []),
      (location || 'A definir').trim(), sector || 'Definido', 'afazer', JSON.stringify(paramsWithIds), Math.max(0, parseInt(toleranceMin, 10) || 0));

  res.status(201).json({ form: formOut(db.prepare('SELECT * FROM forms WHERE id = ?').get(id)) });
});

// "Salvar e Publicar" cria uma nova revisão: a versão vigente anterior é arquivada
// em form_revisions (auditável), nunca sobrescrita silenciosamente.
formsRouter.put('/:id', authenticate, requireRole('gerente'), (req, res) => {
  const existing = db.prepare('SELECT * FROM forms WHERE id = ? AND unidade_id = ?').get(req.params.id, req.user.unidade_id);
  if (!existing) return res.status(404).json({ error: 'Planilha não encontrada.' });
  const err = validatePayload(req.body);
  if (err) return res.status(400).json({ error: err });
  const { title, location, schedule, days, times, due, params, sector, toleranceMin } = req.body;

  db.prepare('INSERT INTO form_revisions (form_id, rev, snapshot_json, archived_at) VALUES (?,?,?,?)')
    .run(existing.id, existing.rev, JSON.stringify(existing), new Date().toISOString());

  const paramsWithIds = params.map(p => ({ ...p, id: p.id || 'p' + Date.now() + Math.random().toString(36).slice(2, 6) }));
  const newRev = (existing.rev || 1) + 1;
  db.prepare(`UPDATE forms SET title=?, due=?, schedule_json=?, days_json=?, times_json=?, location=?, sector=?, params_json=?, rev=?, rev_date=?, tolerance_min=? WHERE id=?`)
    .run(title.trim(), due || '', JSON.stringify(schedule || null), JSON.stringify(days || []), JSON.stringify(times || []),
      (location || existing.location).trim(), sector || existing.sector, JSON.stringify(paramsWithIds), newRev, new Date().toISOString(),
      Math.max(0, parseInt(toleranceMin, 10) || 0), existing.id);

  res.json({ form: formOut(db.prepare('SELECT * FROM forms WHERE id = ?').get(existing.id)) });
});

formsRouter.put('/:id/active', authenticate, requireRole('gerente'), (req, res) => {
  const form = db.prepare('SELECT * FROM forms WHERE id = ? AND unidade_id = ?').get(req.params.id, req.user.unidade_id);
  if (!form) return res.status(404).json({ error: 'Planilha não encontrada.' });
  const active = req.body && typeof req.body.active === 'boolean' ? req.body.active : !form.active;
  db.prepare('UPDATE forms SET active = ? WHERE id = ?').run(active ? 1 : 0, form.id);
  res.json({ form: formOut(db.prepare('SELECT * FROM forms WHERE id = ?').get(form.id)) });
});

// só apaga de fato planilhas sem nenhum registro — com histórico assinado, a exclusão
// quebraria a cadeia de hashes da auditoria, então o caminho correto é desativar.
formsRouter.delete('/:id', authenticate, requireRole('gerente'), (req, res) => {
  const form = db.prepare('SELECT * FROM forms WHERE id = ? AND unidade_id = ?').get(req.params.id, req.user.unidade_id);
  if (!form) return res.status(404).json({ error: 'Planilha não encontrada.' });
  const hasSubs = db.prepare('SELECT 1 FROM submissions WHERE form_id = ? LIMIT 1').get(form.id);
  if (hasSubs) return res.status(409).json({ error: 'Esta planilha já tem registros — desative-a em vez de excluir, para não perder o histórico.' });
  db.prepare('DELETE FROM form_operators WHERE form_id = ?').run(form.id);
  db.prepare('DELETE FROM form_revisions WHERE form_id = ?').run(form.id);
  db.prepare('DELETE FROM forms WHERE id = ?').run(form.id);
  res.json({ ok: true });
});
