import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireTitular } from '../middleware.js';
import { unidadeOut } from '../serialize.js';

export const unidadeRouter = Router();

unidadeRouter.put('/', authenticate, requireTitular, (req, res) => {
  const { razaoSocial, marca, cnpj, sif, endereco, municipio, rtNome, rtRegistro, logo } = req.body || {};
  if (logo && logo.length > 2_200_000) return res.status(413).json({ error: 'Logo muito grande (máx ~1,5MB).' });
  db.prepare(`UPDATE unidade SET razao_social=?, marca=?, cnpj=?, sif=?, endereco=?, municipio=?, rt_nome=?, rt_registro=?, logo=? WHERE id=?`)
    .run(razaoSocial || '', marca || '', cnpj || '', sif || '', endereco || '', municipio || '', rtNome || '', rtRegistro || '', logo || null, req.user.unidade_id);
  res.json({ unidade: unidadeOut(db.prepare('SELECT * FROM unidade WHERE id=?').get(req.user.unidade_id)) });
});
