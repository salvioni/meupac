import { Router } from 'express';
import { db } from '../db.js';
import { authenticate } from '../middleware.js';
import { formOut, pacOut, submissionOut, unidadeOut, visibleToOperator } from '../serialize.js';

export const stateRouter = Router();

stateRouter.get('/', authenticate, (req, res) => {
  const plant = db.prepare('SELECT name FROM plant WHERE id = 1').get();
  const unidade = db.prepare('SELECT * FROM unidade WHERE id = 1').get();
  const allPacs = db.prepare('SELECT * FROM pacs').all();
  const allForms = db.prepare('SELECT * FROM forms').all();

  if (req.user.role === 'gerente') {
    const submissions = db.prepare('SELECT * FROM submissions ORDER BY seq DESC').all();
    return res.json({
      plant: plant ? plant.name : '',
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
  const submissions = db.prepare('SELECT * FROM submissions ORDER BY seq DESC').all()
    .filter(s => visibleFormIds.has(s.form_id));

  res.json({
    plant: plant ? plant.name : '',
    pacs: allPacs.filter(p => visiblePacIds.has(p.id)).map(pacOut),
    forms: visibleForms.map(formOut),
    submissions: submissions.map(submissionOut),
    unidade: unidadeOut(unidade),
  });
});
