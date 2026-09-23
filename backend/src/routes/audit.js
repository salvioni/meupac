import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware.js';
import { recordHash, signatureHash } from '../hash.js';

export const auditRouter = Router();

// Recalcula a cadeia de hashes do zero e confere contra o que está gravado —
// prova (ou desmente) a promessa de "trilha de auditoria imutável" da UI.
auditRouter.get('/verify', authenticate, requireRole('gerente'), (req, res) => {
  const rows = db.prepare('SELECT * FROM submissions WHERE unidade_id = ? ORDER BY seq ASC').all(req.user.unidade_id);
  let prevHash = null;
  const problems = [];
  for (const s of rows) {
    const payload = {
      formId: s.form_id, operatorId: s.operator_id, operatorName: s.operator_name, ts: s.ts,
      values: JSON.parse(s.values_json), conforme: !!s.conforme,
      occurrence: s.occurrence_json ? JSON.parse(s.occurrence_json) : null, note: s.note || '',
    };
    if (s.slot) payload.slot = s.slot; // registros anteriores aos horários não têm slot no hash
    const expected = recordHash(prevHash, payload);
    if (expected !== s.hash) problems.push({ id: s.id, seq: s.seq, issue: 'hash de conteúdo não confere' });
    if (s.signed_by) {
      const expectedSign = signatureHash(s.hash, s.signed_by, s.signed_at);
      if (expectedSign !== s.sign_hash) problems.push({ id: s.id, seq: s.seq, issue: 'hash de assinatura não confere' });
    }
    prevHash = s.hash;
  }
  res.json({ ok: problems.length === 0, checked: rows.length, problems });
});
