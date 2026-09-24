// Fuso horário da unidade (fábrica). "Hoje" e os horários dos avisos seguem o fuso de
// cada unidade — uma fábrica em Cuiabá vira o dia uma hora depois de uma em São Paulo —
// e não o do servidor (na nuvem, normalmente UTC).

// sem fuso salvo na unidade: o do servidor (TZ), e em último caso Brasília
export const DEFAULT_TZ = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

export function validTz(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function unidadeTz(db, unidadeId) {
  const u = db.prepare('SELECT timezone FROM unidade WHERE id = ?').get(unidadeId);
  return u && validTz(u.timezone) ? u.timezone : DEFAULT_TZ;
}

// "AAAA-MM-DD" do instante no fuso dado — pra comparar "é o mesmo dia?"
export function dayKey(date, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
}

// "HH:MM" do instante no fuso dado
export function hhmm(date, tz) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(date));
}
