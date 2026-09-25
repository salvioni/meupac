import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireTitular, requireRole } from '../middleware.js';
import { unidadeOut } from '../serialize.js';
import { toMin } from '../../../frontend/src/schedule.js';
import { validTz } from '../tz.js';
import { checkCnpjMunicipio, formatCnpj } from '../../../frontend/src/br.js';

// 1º turno obrigatório, 2º opcional (ativo: false); cada um com fim depois do início
function validTurnos(turnos) {
  if (!Array.isArray(turnos) || turnos.length < 1 || turnos.length > 2) return 'Informe o 1º turno (e, se houver, o 2º).';
  for (const [i, t] of turnos.entries()) {
    if (i === 0 && t.ativo === false) return 'O 1º turno não pode ser desligado.';
    if (t.ativo === false) continue;
    if (toMin(t.inicio) === null || toMin(t.fim) === null) return `Informe o início e o fim do ${i + 1}º turno.`;
    if (toMin(t.fim) <= toMin(t.inicio)) return `No ${i + 1}º turno, o fim precisa ser depois do início.`;
  }
  return null;
}

export const unidadeRouter = Router();

unidadeRouter.put('/', authenticate, requireTitular, (req, res) => {
  const { razaoSocial, marca, cnpj, sif, endereco, municipio, rtNome, rtRegistro, logo, timezone } = req.body || {};
  const brErr = checkCnpjMunicipio({ cnpj, municipio }); if (brErr) return res.status(400).json({ error: brErr });
  if (timezone !== undefined && !validTz(timezone)) return res.status(400).json({ error: 'Fuso horário inválido.' });
  if (timezone !== undefined) db.prepare('UPDATE unidade SET timezone = ? WHERE id = ?').run(timezone, req.user.unidade_id);
  if (logo && logo.length > 2_200_000) return res.status(413).json({ error: 'Logo muito grande (máx ~1,5MB).' });
  db.prepare(`UPDATE unidade SET razao_social=?, marca=?, cnpj=?, sif=?, endereco=?, municipio=?, rt_nome=?, rt_registro=?, logo=? WHERE id=?`)
    .run(razaoSocial || '', marca || '', formatCnpj(cnpj), sif || '', endereco || '', municipio || '', rtNome || '', rtRegistro || '', logo || null, req.user.unidade_id);
  res.json({ unidade: unidadeOut(db.prepare('SELECT * FROM unidade WHERE id=?').get(req.user.unidade_id)) });
});

// turnos do expediente: editados na tela Equipe por qualquer gestor (é quem monta a
// escala), separado dos dados cadastrais, que só o titular altera.
unidadeRouter.put('/turnos', authenticate, requireRole('gerente'), (req, res) => {
  const { turnos } = req.body || {};
  const err = validTurnos(turnos); if (err) return res.status(400).json({ error: err });
  const clean = turnos.map(t => ({ inicio: String(t.inicio), fim: String(t.fim), ativo: t.ativo !== false }));
  db.prepare('UPDATE unidade SET turnos_json = ? WHERE id = ?').run(JSON.stringify(clean), req.user.unidade_id);
  res.json({ unidade: unidadeOut(db.prepare('SELECT * FROM unidade WHERE id=?').get(req.user.unidade_id)) });
});
