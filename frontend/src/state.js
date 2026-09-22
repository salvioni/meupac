import { isToday } from './helpers.js';

// Cache local do estado vindo do backend (substitui o antigo objeto persistido
// em localStorage). É preenchido por api.refreshState() e só isso — nenhuma
// tela grava direto aqui; toda mutação vai para a API e depois recarrega.
export let DB = { plant: '', pacs: [], forms: [], submissions: [], unidade: {}, team: [] };
export function setDB(next) { DB = next; }

export let currentUser = null;
export function setCurrentUser(u) { currentUser = u; }

export let screen = 'login';
export let params = {};
export function setScreenParams(s, p = {}) { screen = s; params = p; }

export function getForm(id) { return DB.forms.find(f => f.id === id); }
export function getPac(id) { return DB.pacs.find(p => p.id === id); }
export function pacOf(formId) { const f = getForm(formId); return f ? getPac(f.pacId) : null; }
export function subsFor(formId) { return DB.submissions.filter(s => s.formId === formId); }
export function todaySubFor(formId) { return subsFor(formId).find(s => isToday(s.ts)); }

export function formStatus(f) {
  const sub = todaySubFor(f.id);
  if (sub) return sub.occurrence ? 'ocorrencia' : 'concluido';
  return f.defaultStatus === 'concluido' ? 'afazer' : f.defaultStatus;
}

export function daysLabel(days) {
  if (!days || !days.length || days.length === 7) return 'todos os dias';
  const nm = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days.slice().sort((a, b) => a - b).map(i => nm[i]).join(', ');
}

export function dueText(f) {
  const s = f.schedule; let when = '';
  if (s) {
    if (s.type === 'intervalo' && s.every) when = `a cada ${s.every} ${s.unit || 'horas'}`;
    else if (s.type === 'vezes' && s.count) when = `${s.count}x ${s.period === 'semana' ? 'por semana' : s.period === 'mes' ? 'ao mês' : 'ao dia'}`;
    else if (s.type === 'momentos' && s.moments && s.moments.length) { const map = { inicio: 'Início do expediente', fim: 'Fim do expediente' }; when = s.moments.map(m => map[m] || m).join(' e '); }
    else if (s.type === 'demanda') return 'Sob demanda';
    else if (s.type === 'fixos' && s.times && s.times.length) when = 'às ' + s.times.join(', ');
    if (when) return when + ' · ' + daysLabel(s.days);
  }
  const ts = (f.times && f.times.length) ? f.times : (f.due ? [f.due] : []);
  return (ts.length ? 'às ' + ts.join(', ') : 'Sem horário específico') + ' · ' + daysLabel(f.days);
}

export function formOwner(f) { return f.operatorId || null; }
export function visibleToOperator(f, uid) { const o = formOwner(f); return o === null || o === uid; }
export function pacActive(p) { return p && p.active !== false; }
export function getUnidade() { return DB.unidade || {}; }
export function ownerName(f) { const id = formOwner(f); if (!id) return 'Não atribuída'; const u = (DB.team || []).find(t => t.id === id); return u ? u.name : '—'; }

export function isTitular(t) { return !!(t && t.titular); }
export function canManage(t) {
  if (!t || t.id === currentUser.id) return false;
  if (isTitular(t)) return false;
  const meTitular = isTitular(currentUser), meGestor = currentUser.role === 'gerente';
  if (t.role === 'operador') return meTitular || meGestor;
  return meTitular;
}

export function nextPlNum(pacId) { return Math.max(0, ...DB.forms.filter(f => f.pacId === pacId).map(f => f.plNum || 0)) + 1; }
export function plCode(f) { const pac = getPac(f.pacId); return (pac ? pac.code + ' · ' : '') + 'PL ' + String(f.plNum || 0).padStart(2, '0'); }
export function revLabel(f) { return 'Rev. ' + String(f.rev || 1).padStart(2, '0'); }
