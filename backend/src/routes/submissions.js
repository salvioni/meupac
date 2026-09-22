import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware.js';
import { formOut, submissionOut, visibleToOperator } from '../serialize.js';
import { recordHash, signatureHash } from '../hash.js';

export const submissionsRouter = Router();

function lastHash() {
  const row = db.prepare('SELECT hash, seq FROM submissions ORDER BY seq DESC LIMIT 1').get();
  return { prevHash: row ? row.hash : null, nextSeq: row ? row.seq + 1 : 1 };
}

// Só o operador preenche/assina o próprio registro no ato do envio; o servidor
// recalcula a conformidade numérica (não confia no "ok" que o cliente mandaria).
submissionsRouter.post('/', authenticate, requireRole('operador'), (req, res) => {
  const { formId, values, note } = req.body || {};
  const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
  if (!form) return res.status(404).json({ error: 'Planilha não encontrada.' });
  if (!visibleToOperator(form, req.user.id)) return res.status(403).json({ error: 'Você não tem acesso a esta planilha.' });
  const pac = db.prepare('SELECT active FROM pacs WHERE id = ?').get(form.pac_id);
  if (pac && !pac.active) return res.status(409).json({ error: 'O PAC desta planilha está desativado.' });

  const params = JSON.parse(form.params_json);
  if (!values || typeof values !== 'object') return res.status(400).json({ error: 'Envie os valores medidos.' });

  const outValues = {};
  let conforme = true;
  const issues = [];
  for (const p of params) {
    const raw = values[p.id];
    if (raw === null || raw === undefined) return res.status(400).json({ error: `Falta a medição de "${p.name}".` });
    if (p.type === 'numeric') {
      const v = Number(raw);
      if (Number.isNaN(v)) return res.status(400).json({ error: `Valor inválido para "${p.name}".` });
      const ok = v >= p.min && v <= p.max;
      outValues[p.id] = { ok, val: v.toFixed(1) + ' ' + p.unit, num: v };
      if (!ok) { conforme = false; issues.push(`${p.name}: ${v.toFixed(1)} ${p.unit} (faixa ${p.min}–${p.max})`); }
    } else {
      const ok = raw === true;
      outValues[p.id] = { ok, val: ok ? p.good : 'Não conforme' };
      if (!ok) { conforme = false; issues.push(`${p.name}: não conforme`); }
    }
  }

  const id = 's' + Date.now() + Math.random().toString(36).slice(2, 7);
  const ts = new Date().toISOString();
  const occurrence = conforme ? null : { issues, note: String(note || '') };
  const { prevHash, nextSeq } = lastHash();
  const payload = { formId, operatorId: req.user.id, operatorName: req.user.name, ts, values: outValues, conforme, occurrence, note: String(note || '') };
  const hash = recordHash(prevHash, payload);

  db.prepare(`INSERT INTO submissions (id,form_id,operator_id,operator_name,ts,values_json,conforme,occurrence_json,note,signed_by,signed_at,prev_hash,hash,sign_hash,seq)
    VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,?,?,NULL,?)`)
    .run(id, formId, req.user.id, req.user.name, ts, JSON.stringify(outValues), conforme ? 1 : 0, occurrence ? JSON.stringify(occurrence) : null, String(note || ''), prevHash, hash, nextSeq);

  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  res.status(201).json({ submission: submissionOut(row) });
});

function signOne(id, signer) {
  const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  if (!s) return null;
  if (s.signed_by) return s; // já assinado — idempotente, não sobrescreve
  const signedAt = new Date().toISOString();
  const signHash = signatureHash(s.hash, signer.name, signedAt);
  db.prepare('UPDATE submissions SET signed_by = ?, signed_at = ?, sign_hash = ? WHERE id = ?').run(signer.name, signedAt, signHash, id);
  return db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
}

submissionsRouter.post('/:id/sign', authenticate, requireRole('gerente'), (req, res) => {
  const row = signOne(req.params.id, req.user);
  if (!row) return res.status(404).json({ error: 'Registro não encontrado.' });
  res.json({ submission: submissionOut(row) });
});

submissionsRouter.post('/sign-all', authenticate, requireRole('gerente'), (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const pending = db.prepare('SELECT id FROM submissions WHERE signed_by IS NULL AND substr(ts,1,10) = ?').all(today);
  const signed = pending.map(p => signOne(p.id, req.user)).filter(Boolean).map(submissionOut);
  res.json({ signed });
});
