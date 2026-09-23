import { isToday } from './helpers.js';
import { daySlots, toMin, usesWindow, DEFAULT_START, DEFAULT_END } from './schedule.js';

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

// prazo real (em minutos desde 00:00) da planilha hoje — usa o(s) horário(s) fixos
// definidos (ou o "due" legado); o app só rastreia 1 envio/dia, então o prazo é o
// ÚLTIMO horário do dia. Sem horário definido (sob demanda, N vezes, etc.), retorna null.
// ---- horários do dia ----------------------------------------------------------
// Uma planilha pode ter vários horários por dia (fixos, "a cada 2 horas", "3x ao dia"),
// e cada horário precisa do seu envio. Sem horários (momentos, sob demanda...), vale
// 1 envio por dia, sem prazo. O cálculo mora em schedule.js (compartilhado com o backend).
export function formSlots(f) { return daySlots(f.schedule, f.times, f.due); }

// cada horário de hoje com o envio que o cumpre. Envios antigos (sem slot gravado)
// ficam com o horário livre mais próximo antes deles.
export function slotStates(f) {
  const slots = formSlots(f); if (!slots.length) return [];
  const subs = subsFor(f.id).filter(s => isToday(s.ts)).sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const bySlot = new Map();
  subs.forEach(s => { if (s.slot && slots.includes(s.slot) && !bySlot.has(s.slot)) bySlot.set(s.slot, s); });
  subs.filter(s => !s.slot || !slots.includes(s.slot)).forEach(s => {
    const d = new Date(s.ts), m = d.getHours() * 60 + d.getMinutes();
    const free = slots.filter(x => !bySlot.has(x));
    const pick = free.slice().reverse().find(x => toMin(x) <= m) || free[0];
    if (pick) bySlot.set(pick, s);
  });
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  return slots.map(slot => {
    const sub = bySlot.get(slot) || null;
    const status = sub ? (sub.occurrence ? 'ocorrencia' : 'concluido') : nowMin > toMin(slot) + (f.toleranceMin || 0) ? 'atrasado' : 'afazer';
    return { slot, sub, status };
  });
}

// o que o operador precisa fazer agora: os horários atrasados + o próximo a vencer
export function openSlots(f) {
  const pending = slotStates(f).filter(x => !x.sub);
  const late = pending.filter(x => x.status === 'atrasado');
  const next = pending.find(x => x.status !== 'atrasado');
  return next ? [...late, next] : late;
}

// prazo (minutos desde 00:00) do próximo horário em aberto — só pra ordenar listas
export function dueMinutesToday(f) {
  const open = openSlots(f);
  return open.length ? toMin(open[0].slot) : null;
}

export function formStatus(f) {
  const states = slotStates(f);
  if (states.length) {
    if (states.some(x => x.status === 'atrasado')) return 'atrasado';
    if (states.every(x => x.sub)) return states.some(x => x.sub.occurrence) ? 'ocorrencia' : 'concluido';
    return 'afazer';
  }
  const sub = todaySubFor(f.id);
  if (sub) return sub.occurrence ? 'ocorrencia' : 'concluido';
  return 'afazer'; // sem horário não há como estar atrasada
}

export function daysLabel(days) {
  if (!days || !days.length || days.length === 7) return 'todos os dias';
  const nm = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days.slice().sort((a, b) => a - b).map(i => nm[i]).join(', ');
}

export function dueText(f) {
  const s = f.schedule; let when = '';
  if (s) {
    const win = usesWindow(s) ? `, ${s.start || DEFAULT_START}–${s.end || DEFAULT_END}` : '';
    if (s.type === 'intervalo' && s.every) when = `a cada ${s.every} ${s.unit || 'horas'}${win}`;
    else if (s.type === 'vezes' && s.count) when = `${s.count}x ${s.period === 'semana' ? 'por semana' : s.period === 'mes' ? 'ao mês' : 'ao dia'}${win}`;
    else if (s.type === 'momentos' && s.moments && s.moments.length) { const map = { inicio: 'Início do expediente', fim: 'Fim do expediente' }; when = s.moments.map(m => map[m] || m).join(' e '); }
    else if (s.type === 'demanda') return 'Sob demanda';
    else if (s.type === 'fixos' && s.times && s.times.length) when = 'às ' + s.times.join(', ');
    if (when) return when + ' · ' + daysLabel(s.days);
  }
  const ts = formSlots(f);
  return (ts.length ? 'às ' + ts.join(', ') : 'Sem horário específico') + ' · ' + daysLabel(f.days);
}

export function formOwnerIds(f) { return f.operatorIds || []; }
export function visibleToOperator(f, uid) { const ids = formOwnerIds(f); return ids.length === 0 || ids.includes(uid); }
export function pacActive(p) { return p && p.active !== false; }
export function formActive(f) { return f && f.active !== false; }
export function getUnidade() { return DB.unidade || {}; }
export function formOwners(f) { return formOwnerIds(f).map(id => (DB.team || []).find(t => t.id === id)).filter(Boolean); }
export function ownerName(f) { const names = formOwners(f).map(u => u.name); return names.length ? names.join(', ') : '—'; }

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
