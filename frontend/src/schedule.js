// Horários do dia de uma planilha — módulo puro (sem DOM), importado tanto pelo
// frontend quanto pelo backend (routes/submissions.js), pra que a tela e o servidor
// nunca discordem sobre quais horários existem.
//
// Cada horário ("slot") é uma pendência própria: "a cada 2 horas das 06:00 às 18:00"
// vira 06:00, 08:00, ..., 18:00, e cada um precisa do seu envio. Frequências sem
// horário (momentos, sob demanda, N vezes por semana/mês) não geram slots — nelas
// continua valendo 1 envio por dia, sem prazo.

export const DEFAULT_START = '06:00';
export const DEFAULT_END = '18:00';
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

function windowOf(schedule) {
  const start = toMin(schedule.start) ?? toMin(DEFAULT_START);
  const end = toMin(schedule.end) ?? toMin(DEFAULT_END);
  return end > start ? { start, end } : null;
}

// true quando a frequência usa a janela início/fim (é o que o editor mostra)
export function usesWindow(schedule) {
  if (!schedule) return false;
  if (schedule.type === 'intervalo') return schedule.unit === 'horas' || schedule.unit === 'minutos';
  if (schedule.type === 'vezes') return (schedule.period || 'dia') === 'dia';
  return false;
}

// times/due: campos legados da planilha (antes de existir schedule.times)
export function daySlots(schedule, times, due) {
  const type = schedule && schedule.type;
  if (!type || type === 'fixos') {
    const list = (schedule && schedule.times && schedule.times.length) ? schedule.times
      : (times && times.length) ? times : (due ? [due] : []);
    return [...new Set(list.map(toMin).filter(n => n !== null))].sort((a, b) => a - b).map(fromMin);
  }
  if (!usesWindow(schedule)) return [];
  const win = windowOf(schedule); if (!win) return [];
  const out = [];
  if (type === 'intervalo') {
    const step = Math.max(1, Number(schedule.every) || 1) * (schedule.unit === 'minutos' ? 1 : 60);
    for (let t = win.start; t <= win.end && out.length < MAX_SLOTS; t += step) out.push(t);
  } else {
    const n = Math.min(MAX_SLOTS, Math.max(1, Number(schedule.count) || 1));
    if (n === 1) out.push(win.start);
    else for (let i = 0; i < n; i++) out.push(win.start + Math.round(i * (win.end - win.start) / (n - 1)));
  }
  return [...new Set(out)].map(fromMin);
}

// dias da semana em que a planilha é preenchida (0 = domingo … 6 = sábado, igual a
// Date.getDay()). Lista vazia = todos os dias; "sob demanda" não tem dia fixo.
export function activeOn(schedule, days, date = new Date()) {
  if (schedule && schedule.type === 'demanda') return true;
  const list = (schedule && schedule.days && schedule.days.length) ? schedule.days : (days || []);
  return !list.length || list.map(Number).includes(date.getDay());
}
