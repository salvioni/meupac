import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware.js';
import { unidadeOut } from '../serialize.js';

export const unidadeRouter = Router();

unidadeRouter.put('/', authenticate, requireRole('gerente'), (req, res) => {
  const { razaoSocial, marca, cnpj, sif, endereco, municipio, rtNome, rtRegistro, logo } = req.body || {};
  if (logo && logo.length > 2_200_000) return res.status(413).json({ error: 'Logo muito grande (máx ~1,5MB).' });
  db.prepare(`UPDATE unidade SET razao_social=?, marca=?, cnpj=?, sif=?, endereco=?, municipio=?, rt_nome=?, rt_registro=?, logo=? WHERE id=1`)
    .run(razaoSocial || '', marca || '', cnpj || '', sif || '', endereco || '', municipio || '', rtNome || '', rtRegistro || '', logo || null);
  res.json({ unidade: unidadeOut(db.prepare('SELECT * FROM unidade WHERE id=1').get()) });
});
