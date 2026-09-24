import { isToday } from './helpers.js';
import { daySlots, slotInfo, toMin, usesWindow, activeOn, windowText, momentsText, activeTurnos } from './schedule.js';

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

// ---- horários do dia ----------------------------------------------------------
// Uma planilha pode ter vários horários por dia (fixos, "a cada 2 horas", "3x ao dia"),
// e cada horário precisa do seu envio. Sem horários (momentos, sob demanda...), vale
// 1 envio por dia, sem prazo. O cálculo mora em schedule.js (compartilhado com o backend).
// turnos do expediente da unidade (null = padrão de schedule.js)
export function unitTurnos() { return (DB.unidade && DB.unidade.turnos) || null; }
export function formSlots(f) { return daySlots(f.schedule, f.times, f.due, unitTurnos()); }
// hoje é um dos dias marcados no editor?
export function activeToday(f) { return activeOn(f.schedule, f.days); }

// ---- quem preenche -----------------------------------------------------------------
// "um" (padrão): o primeiro envio conclui o horário — registros sobre o processo/local
// (cloro, câmara…), e ter mais gente com acesso é cobertura. "cada": cada pessoa envia o
// seu — registros sobre a própria pessoa (autodeclaração de saúde, uniforme, ciência de POP).
export const isCada = f => f.fillMode === 'cada';

// quem precisa enviar numa planilha "cada pessoa" (só o gestor tem DB.team): operadores
// com acesso — ou todos, se a planilha não tem ninguém designado — do turno do horário.
export function requiredPeople(f, turnos = []) {
  const ops = (DB.team || []).filter(t => t.role === 'operador' && t.active !== false);
  const withAccess = f.operatorIds && f.operatorIds.length ? ops.filter(t => f.operatorIds.includes(t.id)) : ops;
  return withAccess.filter(t => slotVisibleTo(t)({ turnos }));
}
function cadaProgress(f, subs, turnos) {
  const req = requiredPeople(f, turnos);
  const done = new Set(subs.map(s => s.operatorId));
  const faltam = req.filter(t => !done.has(t.id));
  return { feitos: req.length ? req.length - faltam.length : subs.length, total: req.length, faltam, complete: req.length ? !faltam.length : subs.length > 0 };
}

// envios de hoje que contam pra "who": numa planilha "cada pessoa", só os dele
function todaySubs(f, who) {
  return subsFor(f.id).filter(s => isToday(s.ts) && (!who || !isCada(f) || s.operatorId === who.id))
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
}
// o envio de hoje de uma planilha sem horários (visto por "who")
export function daySub(f, who = null) { return todaySubs(f, who)[0] || null; }

// cada horário de hoje com o envio que o cumpre. Envios antigos (sem slot gravado)
// ficam com o horário livre mais próximo antes deles. Um envio cujo horário deixou de
// existir (ex.: turno desligado) não é reaproveitado para outro horário.
// who: a pessoa do ponto de vista (operador); sem who = visão do gestor, em que um
// horário "cada pessoa" só está feito quando todos os responsáveis enviaram.
export function slotStates(f, who = null) {
  const slots = formSlots(f); if (!slots.length) return [];
  const info = Object.fromEntries(slotInfo(f.schedule, f.times, f.due, unitTurnos()).map(x => [x.time, x]));
  const subs = todaySubs(f, who);
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const late = slot => nowMin > toMin(slot) + (f.toleranceMin || 0);
  if (isCada(f) && !who) {
    return slots.map(slot => {
      const ss = subs.filter(s => s.slot === slot), prog = cadaProgress(f, ss, info[slot].turnos);
      const status = prog.complete ? (ss.some(s => s.occurrence) ? 'ocorrencia' : 'concluido') : late(slot) ? 'atrasado' : 'afazer';
      return { slot, sub: prog.complete ? ss[ss.length - 1] : null, subs: ss, ...prog, status, label: info[slot].label || null, turnos: info[slot].turnos };
    });
  }
  const bySlot = new Map();
  subs.forEach(s => { if (s.slot && slots.includes(s.slot) && !bySlot.has(s.slot)) bySlot.set(s.slot, s); });
  subs.filter(s => !s.slot).forEach(s => {
    const d = new Date(s.ts), m = d.getHours() * 60 + d.getMinutes();
    const free = slots.filter(x => !bySlot.has(x));
    const pick = free.slice().reverse().find(x => toMin(x) <= m) || free[0];
    if (pick) bySlot.set(pick, s);
  });
  return slots.map(slot => {
    const sub = bySlot.get(slot) || null;
    const status = sub ? (sub.occurrence ? 'ocorrencia' : 'concluido') : late(slot) ? 'atrasado' : 'afazer';
    return { slot, sub, status, label: info[slot].label || null, turnos: info[slot].turnos };
  });
}

// todos os horários de hoje ainda sem envio (painel do gestor: o dia inteiro)
export function pendingSlots(f) {
  return activeToday(f) ? slotStates(f).filter(x => !x.sub) : [];
}

// o que o operador precisa fazer agora: os horários atrasados + o próximo a vencer.
// keep filtra os horários (ex.: só os do turno da pessoa) antes de escolher o próximo.
export function openSlots(f, keep = () => true, who = null) {
  if (!activeToday(f)) return [];
  const pending = slotStates(f, who).filter(x => !x.sub && keep(x));
  const late = pending.filter(x => x.status === 'atrasado');
  const next = pending.find(x => x.status !== 'atrasado');
  return next ? [...late, next] : late;
}

// cada operador vê só os horários do seu turno; sem turno definido (ambos), ou com a
// unidade num turno só, vê tudo. Horário fora de qualquer turno vale pra todos.
export function slotVisibleTo(user) {
  const act = activeTurnos(unitTurnos()).map(t => t.idx);
  const my = user && user.role === 'operador' && act.length > 1 && act.includes(user.turnoIdx) ? user.turnoIdx : null;
  return x => my === null || !x.turnos.length || x.turnos.includes(my);
}

// prazo (minutos desde 00:00) do próximo horário em aberto — só pra ordenar listas
export function dueMinutesToday(f) {
  const open = openSlots(f);
  return open.length ? toMin(open[0].slot) : null;
}

export function formStatus(f) {
  // fora dos dias marcados não há o que cobrar (a não ser que tenham preenchido mesmo assim)
  if (!activeToday(f)) { const sub = todaySubFor(f.id); return sub ? (sub.occurrence ? 'ocorrencia' : 'concluido') : 'folga'; }
  const states = slotStates(f);
  if (states.length) {
    if (states.some(x => x.status === 'atrasado')) return 'atrasado';
    if (states.every(x => x.sub)) return states.some(x => x.sub.occurrence) ? 'ocorrencia' : 'concluido';
    return 'afazer';
  }
  if (isCada(f)) {
    const subs = todaySubs(f), prog = cadaProgress(f, subs, []);
    return prog.complete ? (subs.some(s => s.occurrence) ? 'ocorrencia' : 'concluido') : 'afazer';
  }
  const sub = todaySubFor(f.id);
  if (sub) return sub.occurrence ? 'ocorrencia' : 'concluido';
  return 'afazer'; // sem horário não há como estar atrasada
}

// progresso de hoje de uma planilha "cada pessoa" sem horários (painel do gestor)
export function dayProgress(f) { return cadaProgress(f, todaySubs(f), []); }

export function daysLabel(days) {
  if (!days || !days.length || days.length === 7) return 'todos os dias';
  const nm = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days.slice().sort((a, b) => a - b).map(i => nm[i]).join(', ');
}

export function dueText(f) {
  const s = f.schedule; let when = '';
  if (s) {
    const win = usesWindow(s) ? `, ${windowText(s, unitTurnos())}` : '';
    if (s.type === 'intervalo' && s.every) when = `a cada ${s.every} ${s.unit || 'horas'}${win}`;
    else if (s.type === 'vezes' && s.count) when = `${s.count}x ${s.period === 'semana' ? 'por semana' : s.period === 'mes' ? 'ao mês' : 'ao dia'}${win}`;
    else if (s.type === 'momentos' && s.moments && s.moments.length) when = momentsText(s, unitTurnos());
    else if (s.type === 'demanda') return 'Sob demanda';
    else if (s.type === 'fixos' && s.semHorario) when = '1x ao dia, sem horário';
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
