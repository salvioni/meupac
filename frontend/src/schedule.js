// Horários do dia de uma planilha — módulo puro (sem DOM), importado tanto pelo
// frontend quanto pelo backend (routes/submissions.js), pra que a tela e o servidor
// nunca discordem sobre quais horários existem.
//
// Cada horário ("slot") é uma pendência própria: "a cada 2 horas das 06:00 às 18:00"
// vira 06:00, 08:00, ..., 18:00, e cada um precisa do seu envio. "Início do turno"
// vira o horário de início de cada turno escolhido. Frequências sem horário (sob
// demanda, N vezes por semana/mês) não geram slots — nelas vale 1 envio por dia, sem prazo.
//
// Os turnos (expediente) são configurados uma vez por unidade; a janela padrão de
// "a cada X horas"/"N vezes ao dia" é o expediente inteiro (início do 1º ao fim do último).

export const DEFAULT_TURNOS = [
  { inicio: '06:00', fim: '14:00', ativo: true },
  { inicio: '14:00', fim: '22:00', ativo: true },
];
// conta nova: um turno só e sem horário — não dá pra adivinhar o expediente da fábrica,
// o gestor define em Equipe › Turnos. (Unidade antiga sem nada salvo = null = DEFAULT_TURNOS.)
export const TURNOS_A_DEFINIR = [
  { inicio: '', fim: '', ativo: true },
  { inicio: '', fim: '', ativo: false },
];
const MAX_SLOTS = 96; // teto de segurança (ex.: "a cada 1 minuto")

export function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}
export function fromMin(n) {
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

// turnos válidos e ligados, com a posição original (0 = 1º turno, 1 = 2º turno)
export function activeTurnos(turnos) {
  const list = (Array.isArray(turnos) && turnos.length ? turnos : DEFAULT_TURNOS)
    .map((t, idx) => ({ ...t, idx }))
    .filter(t => t.ativo !== false && toMin(t.inicio) !== null && toMin(t.fim) > toMin(t.inicio));
  return list.length ? list : DEFAULT_TURNOS.slice(0, 1).map(t => ({ ...t, idx: 0 }));
}

// o horário do expediente já foi definido? (null = unidade antiga, usa o padrão)
export function turnosDefinidos(turnos) {
  if (turnos == null) return true;
  return Array.isArray(turnos) && turnos.some(t => t.ativo !== false && toMin(t.inicio) !== null && toMin(t.fim) > toMin(t.inicio));
}

export function expediente(turnos) {
  const act = activeTurnos(turnos);
  return { start: fromMin(Math.min(...act.map(t => toMin(t.inicio)))), end: fromMin(Math.max(...act.map(t => toMin(t.fim)))) };
}

// "a cada X horas"/"N vezes ao dia" valem nos turnos escolhidos (schedule.turnos; sem
// escolha = todos) ou num horário personalizado (schedule.start/end).
export function isCustomWindow(schedule) { return !!(schedule && (schedule.start || schedule.end)); }
function windowTurnos(schedule, turnos) {
  const act = activeTurnos(turnos);
  const chosen = Array.isArray(schedule.turnos) && schedule.turnos.length ? act.filter(t => schedule.turnos.includes(t.idx)) : act;
  return chosen.length ? chosen : act;
}
// janelas em minutos: uma por turno escolhido (o intervalo recomeça no início de cada
// turno) ou a personalizada
function windowsOf(schedule, turnos) {
  if (isCustomWindow(schedule)) {
    const exp = expediente(turnos);
    const start = toMin(schedule.start) ?? toMin(exp.start), end = toMin(schedule.end) ?? toMin(exp.end);
    return end > start ? [{ start, end }] : [];
  }
  return windowTurnos(schedule, turnos).map(t => ({ start: toMin(t.inicio), end: toMin(t.fim), idx: t.idx }));
}
export function windowText(schedule, turnos) {
  if (isCustomWindow(schedule)) { const w = windowsOf(schedule, turnos)[0]; return w ? `${fromMin(w.start)}–${fromMin(w.end)}` : ''; }
  const act = activeTurnos(turnos), chosen = windowTurnos(schedule, turnos);
  if (chosen.length === act.length) { const e = expediente(turnos); return `${e.start}–${e.end}`; }
  return chosen.map(t => `${t.idx + 1}º turno`).join(' e ');
}

// true quando a frequência usa a janela início/fim (é o que o editor mostra)
export function usesWindow(schedule) {
  if (!schedule) return false;
  if (schedule.type === 'intervalo') return schedule.unit === 'horas' || schedule.unit === 'minutos';
  if (schedule.type === 'vezes') return (schedule.period || 'dia') === 'dia';
  return false;
}

// "Início do 1º turno", "Fim do expediente" etc. Com um turno só, fala "expediente".
function momentLabel(moment, turno, nTurnos) {
  const qual = moment === 'fim' ? 'Fim' : 'Início';
  return nTurnos > 1 ? `${qual} do ${turno.idx + 1}º turno` : `${qual} do expediente`;
}

// turnos em que uma planilha de "momentos" vale. Sem escolha salva = só o 1º turno
// (o gestor marca o 2º onde fizer sentido, ex.: barreira sanitária a cada entrada de equipe).
function momentTurnos(schedule, turnos) {
  const act = activeTurnos(turnos);
  const chosen = Array.isArray(schedule.turnos) && schedule.turnos.length ? act.filter(t => schedule.turnos.includes(t.idx)) : [];
  return { act, chosen: chosen.length ? chosen : act.slice(0, 1) };
}

// [{ time: "HH:MM", label }] em ordem de horário. label só existe para "momentos".
function slotList(schedule, times, due, turnos) {
  const type = schedule && schedule.type;
  let out = [];
  if (!type || type === 'fixos') {
    const list = (schedule && schedule.times && schedule.times.length) ? schedule.times
      : (times && times.length) ? times : (due ? [due] : []);
    out = list.map(t => ({ min: toMin(t), label: null }));
  } else if (type === 'momentos') {
    const { act, chosen } = momentTurnos(schedule, turnos);
    const moments = (schedule.moments || []).filter(m => m === 'inicio' || m === 'fim');
    chosen.forEach(t => moments.forEach(m => out.push({ min: toMin(m === 'fim' ? t.fim : t.inicio), label: momentLabel(m, t, act.length), turno: t.idx })));
  } else if (usesWindow(schedule)) {
    const wins = windowsOf(schedule, turnos); if (!wins.length) return [];
    if (type === 'intervalo') {
      const step = Math.max(1, Number(schedule.every) || 1) * (schedule.unit === 'minutos' ? 1 : 60);
      // cada horário pertence ao turno de onde veio (o 14:00 do "1º turno 06–14" é da manhã)
      wins.forEach(win => { for (let t = win.start; t <= win.end && out.length < MAX_SLOTS; t += step) out.push(win.idx !== undefined ? { min: t, label: null, turno: win.idx } : { min: t, label: null }); });
    } else {
      // N vezes: distribuídas do início do primeiro turno escolhido ao fim do último
      const win = { start: Math.min(...wins.map(w => w.start)), end: Math.max(...wins.map(w => w.end)) };
      const n = Math.min(MAX_SLOTS, Math.max(1, Number(schedule.count) || 1));
      if (n === 1) out.push({ min: win.start, label: null });
      else for (let i = 0; i < n; i++) out.push({ min: win.start + Math.round(i * (win.end - win.start) / (n - 1)), label: null });
    }
  }
  // mesmo horário duas vezes (ex.: fim do 1º turno = início do 2º) vira um registro só,
  // com os dois rótulos
  const byMin = new Map();
  out.filter(x => x.min !== null).forEach(x => {
    const turnosDoSlot = x.turno !== undefined ? [x.turno] : turnoAt(x.min, turnos);
    const prev = byMin.get(x.min);
    if (!prev) byMin.set(x.min, { ...x, turnos: turnosDoSlot });
    else {
      if (x.label && prev.label !== x.label) prev.label = prev.label ? `${prev.label} / ${x.label}` : x.label;
      turnosDoSlot.forEach(i => { if (!prev.turnos.includes(i)) prev.turnos.push(i); });
    }
  });
  return [...byMin.values()].sort((a, b) => a.min - b.min).map(x => ({ time: fromMin(x.min), label: x.label, turnos: x.turnos }));
}

// a qual turno pertence um horário: o que o contém (início ≤ h < fim); o fim do
// último turno conta como dele. Fora de qualquer turno = [] (vale pra todos).
function turnoAt(min, turnos) {
  const act = activeTurnos(turnos);
  const t = act.find(t => min >= toMin(t.inicio) && min < toMin(t.fim)) || act.find(t => min === toMin(t.fim));
  return t ? [t.idx] : [];
}

// times/due: campos legados da planilha (antes de existir schedule.times)
export function daySlots(schedule, times, due, turnos) {
  return slotList(schedule, times, due, turnos).map(x => x.time);
}
// [{ time, label, turnos: [idx…] }] — pra saber a quem mostrar cada horário
export function slotInfo(schedule, times, due, turnos) {
  return slotList(schedule, times, due, turnos);
}
export function slotLabels(schedule, times, due, turnos) {
  const map = {};
  slotList(schedule, times, due, turnos).forEach(x => { if (x.label) map[x.time] = x.label; });
  return map;
}

// descrição curta de uma planilha de "momentos": "Início de cada turno", "Fim do 2º turno"…
export function momentsText(schedule, turnos) {
  const { act, chosen } = momentTurnos(schedule, turnos);
  const ms = (schedule.moments || []).filter(m => m === 'inicio' || m === 'fim');
  const qual = ms.length === 2 ? 'Início e fim' : ms[0] === 'fim' ? 'Fim' : 'Início';
  if (act.length < 2) return `${qual} do expediente`;
  if (chosen.length === act.length) return `${qual} de cada turno`;
  return `${qual} do ${chosen[0].idx + 1}º turno`;
}

// dias da semana em que a planilha é preenchida (0 = domingo … 6 = sábado, igual a
// Date.getDay()). Lista vazia = todos os dias; "sob demanda" não tem dia fixo.
export function activeOn(schedule, days, date = new Date()) {
  if (schedule && schedule.type === 'demanda') return true;
  const list = (schedule && schedule.days && schedule.days.length) ? schedule.days : (days || []);
  return !list.length || list.map(Number).includes(date.getDay());
}
