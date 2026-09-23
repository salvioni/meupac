// Conversão linha-do-banco -> objeto JSON no mesmo formato que o frontend já espera
// (o mesmo "shape" do antigo objeto DB em localStorage), pra minimizar mudanças na UI.

import { db } from './db.js';

// uma planilha pode ter vários operadores autorizados; sem nenhum vínculo, ela fica
// aberta a todos os operadores (como um PAC sem restrição extra de acesso).
export function formOperatorIds(formId) {
  return db.prepare('SELECT operator_id FROM form_operators WHERE form_id = ?').all(formId).map(r => r.operator_id);
}

export function formOut(f) {
  return {
    id: f.id, pacId: f.pac_id, plNum: f.pl_num, rev: f.rev, revDate: f.rev_date,
    title: f.title, due: f.due,
    schedule: f.schedule_json ? JSON.parse(f.schedule_json) : null,
    days: f.days_json ? JSON.parse(f.days_json) : [],
    times: f.times_json ? JSON.parse(f.times_json) : [],
    location: f.location, sector: f.sector, defaultStatus: f.default_status,
    toleranceMin: f.tolerance_min || 0, active: !!f.active,
    params: JSON.parse(f.params_json), operatorIds: formOperatorIds(f.id),
  };
}

export function pacOut(p) {
  return { id: p.id, code: p.code, name: p.name, icon: p.icon, norm: p.norm, description: p.description || '', active: !!p.active };
}

export function submissionOut(s) {
  return {
    id: s.id, formId: s.form_id, operatorId: s.operator_id, operatorName: s.operator_name, ts: s.ts,
    values: JSON.parse(s.values_json), conforme: !!s.conforme,
    occurrence: s.occurrence_json ? JSON.parse(s.occurrence_json) : null,
    note: s.note || '', slot: s.slot || null, signedBy: s.signed_by, signedAt: s.signed_at,
    hash: s.hash, prevHash: s.prev_hash, signHash: s.sign_hash,
  };
}

export function unidadeOut(u) {
  if (!u) return {};
  return {
    razaoSocial: u.razao_social, marca: u.marca, cnpj: u.cnpj, sif: u.sif,
    endereco: u.endereco, municipio: u.municipio, rtNome: u.rt_nome, rtRegistro: u.rt_registro, logo: u.logo,
    turnos: u.turnos_json ? JSON.parse(u.turnos_json) : null,
  };
}

export function teamMemberOut(u) {
  return {
    id: u.id, name: u.name, role: u.role, titular: !!u.titular,
    cargo: u.cargo, turno: u.turno, matricula: u.matricula,
    initials: u.initials, color: u.color, ink: u.ink, active: !!u.active,
  };
}

export function visibleToOperator(form, uid) {
  const ids = formOperatorIds(form.id);
  return ids.length === 0 || ids.includes(uid);
}
