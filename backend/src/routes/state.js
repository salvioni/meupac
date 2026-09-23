import { Router } from 'express';
import { db } from '../db.js';
import { authenticate } from '../middleware.js';
import { formOut, pacOut, submissionOut, unidadeOut, visibleToOperator } from '../serialize.js';

export const stateRouter = Router();

stateRouter.get('/', authenticate, (req, res) => {
  const unidadeId = req.user.unidade_id;
  const unidade = db.prepare('SELECT * FROM unidade WHERE id = ?').get(unidadeId);
  const allPacs = db.prepare('SELECT * FROM pacs WHERE unidade_id = ?').all(unidadeId);
  const allForms = db.prepare('SELECT * FROM forms WHERE unidade_id = ?').all(unidadeId);
  const plant = unidade ? [unidade.razao_social, unidade.sif].filter(Boolean).join(' — ') : '';

  if (req.user.role === 'gerente') {
    const submissions = db.prepare('SELECT * FROM submissions WHERE unidade_id = ? ORDER BY seq DESC').all(unidadeId);
    return res.json({
      plant,
      pacs: allPacs.map(pacOut),
      forms: allForms.map(formOut),
      submissions: submissions.map(submissionOut),
      unidade: unidadeOut(unidade),
    });
  }

  // operador: só vê planilhas visíveis a ele (dono = ele ou ainda não atribuída) e só de PACs ativos,
  // e só os registros dessas planilhas — o servidor, não a UI, decide o que sai daqui.
  const visibleForms = allForms.filter(f => visibleToOperator(f, req.user.id));
  const visibleFormIds = new Set(visibleForms.map(f => f.id));
  const visiblePacIds = new Set(visibleForms.map(f => f.pac_id));
  const submissions = db.prepare('SELECT * FROM submissions WHERE unidade_id = ? ORDER BY seq DESC').all(unidadeId)
    .filter(s => visibleFormIds.has(s.form_id));

  res.json({
    plant,
    pacs: allPacs.filter(p => visiblePacIds.has(p.id)).map(pacOut),
    forms: visibleForms.map(formOut),
    submissions: submissions.map(submissionOut),
    unidade: unidadeOut(unidade),
  });
});
