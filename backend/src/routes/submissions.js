import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware.js';
import { submissionOut, visibleToOperator } from '../serialize.js';
import { recordHash, signatureHash } from '../hash.js';
// mesmo cálculo de horários que a tela usa (módulo puro compartilhado com o frontend)
import { daySlots } from '../../../frontend/src/schedule.js';

export const submissionsRouter = Router();

// a cadeia de hashes é por unidade: cada empresa tem sua própria sequência (seq)
// e seu próprio encadeamento, isolados dos de qualquer outra empresa.
function lastHash(unidadeId) {
  const row = db.prepare('SELECT hash, seq FROM submissions WHERE unidade_id = ? ORDER BY seq DESC LIMIT 1').get(unidadeId);
  return { prevHash: row ? row.hash : null, nextSeq: row ? row.seq + 1 : 1 };
}

// Só o operador preenche/assina o próprio registro no ato do envio; o servidor
// recalcula a conformidade numérica (não confia no "ok" que o cliente mandaria).
submissionsRouter.post('/', authenticate, requireRole('operador'), (req, res) => {
  const { formId, values, note } = req.body || {};
  const form = db.prepare('SELECT * FROM forms WHERE id = ? AND unidade_id = ?').get(formId, req.user.unidade_id);
  if (!form) return res.status(404).json({ error: 'Planilha não encontrada.' });
  if (!visibleToOperator(form, req.user.id)) return res.status(403).json({ error: 'Você não tem acesso a esta planilha.' });
  if (!form.active) return res.status(409).json({ error: 'Esta planilha está desativada.' });
  const pac = db.prepare('SELECT active FROM pacs WHERE id = ?').get(form.pac_id);
  if (pac && !pac.active) return res.status(409).json({ error: 'O PAC desta planilha está desativado.' });

  const params = JSON.parse(form.params_json);
  if (!values || typeof values !== 'object') return res.status(400).json({ error: 'Envie os valores medidos.' });

  // planilha com horários (ex.: a cada 2h): cada envio cumpre um horário específico,
  // que precisa existir e ainda não ter sido registrado hoje.
  const slots = daySlots(JSON.parse(form.schedule_json || 'null'), JSON.parse(form.times_json || '[]'), form.due);
  let slot = null;
  if (slots.length) {
    slot = String(req.body.slot || '');
    if (!slots.includes(slot)) return res.status(400).json({ error: 'Horário inválido para esta planilha.' });
    const today = new Date().toDateString();
    const taken = db.prepare('SELECT ts FROM submissions WHERE form_id = ? AND slot = ?').all(form.id, slot)
      .some(r => new Date(r.ts).toDateString() === today);
    if (taken) return res.status(409).json({ error: `O horário ${slot} desta planilha já foi registrado hoje.` });
  }

  const outValues = {};
  let conforme = true;
  const issues = [];
  for (const p of params) {
    const raw = values[p.id];
    const missing = raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim());
    if (missing) {
      if (p.required === false) { outValues[p.id] = { ok: true, val: '—' }; continue; }
      return res.status(400).json({ error: `Falta preencher "${p.name}".` });
    }

    if (p.type === 'numeric') {
      const v = Number(raw);
      if (Number.isNaN(v)) return res.status(400).json({ error: `Valor inválido para "${p.name}".` });
      const ok = v >= p.min && v <= p.max;
      outValues[p.id] = { ok, val: v.toFixed(1) + ' ' + p.unit, num: v };
      if (!ok) { conforme = false; issues.push(`${p.name}: ${v.toFixed(1)} ${p.unit} (faixa ${p.min}–${p.max})`); }
    } else if (p.type === 'numero') {
      const v = Number(raw);
      if (Number.isNaN(v)) return res.status(400).json({ error: `Valor inválido para "${p.name}".` });
      outValues[p.id] = { ok: true, val: String(v) + (p.unit ? ' ' + p.unit : ''), num: v }; // sem arredondar: é o valor exato digitado
    } else if (p.type === 'texto') {
      outValues[p.id] = { ok: true, val: String(raw).trim() };
    } else if (p.type === 'simnao') {
      outValues[p.id] = { ok: true, val: raw === true ? 'Sim' : 'Não' };
    } else if (p.type === 'data') {
      outValues[p.id] = { ok: true, val: String(raw) };
    } else if (p.type === 'hora') {
      outValues[p.id] = { ok: true, val: String(raw) };
    } else if (p.type === 'escolha') {
      const options = Array.isArray(p.options) ? p.options : [];
      if (!options.includes(raw)) return res.status(400).json({ error: `Opção inválida para "${p.name}".` });
      const ok = !(Array.isArray(p.ncOptions) && p.ncOptions.includes(raw));
      outValues[p.id] = { ok, val: String(raw) };
      if (!ok) { conforme = false; issues.push(`${p.name}: ${raw}`); }
    } else {
      const ok = raw === true;
      outValues[p.id] = { ok, val: ok ? p.good : 'Não conforme' };
      if (!ok) { conforme = false; issues.push(`${p.name}: não conforme`); }
    }
  }

  const id = 's' + Date.now() + Math.random().toString(36).slice(2, 7);
  const ts = new Date().toISOString();
  const occurrence = conforme ? null : { issues, note: String(note || '') };
  const { prevHash, nextSeq } = lastHash(req.user.unidade_id);
  const payload = { formId, operatorId: req.user.id, operatorName: req.user.name, ts, values: outValues, conforme, occurrence, note: String(note || '') };
  if (slot) payload.slot = slot; // só entra no hash quando existe (compatível com a cadeia antiga)
  const hash = recordHash(prevHash, payload);

  db.prepare(`INSERT INTO submissions (id,unidade_id,form_id,operator_id,operator_name,ts,values_json,conforme,occurrence_json,note,signed_by,signed_at,prev_hash,hash,sign_hash,seq,slot)
    VALUES (?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,?,NULL,?,?)`)
    .run(id, req.user.unidade_id, formId, req.user.id, req.user.name, ts, JSON.stringify(outValues), conforme ? 1 : 0, occurrence ? JSON.stringify(occurrence) : null, String(note || ''), prevHash, hash, nextSeq, slot);

  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  res.status(201).json({ submission: submissionOut(row) });
});

function signOne(id, unidadeId, signer) {
  const s = db.prepare('SELECT * FROM submissions WHERE id = ? AND unidade_id = ?').get(id, unidadeId);
  if (!s) return null;
  if (s.signed_by) return s; // já assinado — idempotente, não sobrescreve
  const signedAt = new Date().toISOString();
  const signHash = signatureHash(s.hash, signer.name, signedAt);
  db.prepare('UPDATE submissions SET signed_by = ?, signed_at = ?, sign_hash = ? WHERE id = ?').run(signer.name, signedAt, signHash, id);
  return db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
}

submissionsRouter.post('/:id/sign', authenticate, requireRole('gerente'), (req, res) => {
  const row = signOne(req.params.id, req.user.unidade_id, req.user);
  if (!row) return res.status(404).json({ error: 'Registro não encontrado.' });
  res.json({ submission: submissionOut(row) });
});

submissionsRouter.post('/sign-all', authenticate, requireRole('gerente'), (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const pending = db.prepare('SELECT id FROM submissions WHERE signed_by IS NULL AND substr(ts,1,10) = ? AND unidade_id = ?').all(today, req.user.unidade_id);
  const signed = pending.map(p => signOne(p.id, req.user.unidade_id, req.user)).filter(Boolean).map(submissionOut);
  res.json({ signed });
});
