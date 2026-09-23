import { $, esc, icon, toast } from '../helpers.js';
import { params, getForm, getPac, DB, nextPlNum, revLabel, unitTurnos } from '../state.js';
import { shell, profileTrigger } from '../ui.js';
import { GE_NAV } from '../config.js';
import * as api from '../api.js';
import { navigate, closeModal } from '../router.js';
import { daySlots, slotLabels, toMin, usesWindow, expediente, activeTurnos } from '../schedule.js';

const app = () => $('app');

export function renderFormEditor() {
  const editing = params.form ? getForm(params.form) : null;
  const pac = editing ? getPac(editing.pacId) : getPac(params.pac || DB.pacs[0].id);
  window.__editorParams = editing ? JSON.parse(JSON.stringify(editing.params)) : [{ id: 'np' + Date.now(), type: 'numeric', name: '', unit: '', min: 0, max: 0, step: 0.1, seed: 0 }];
  window.__editorTimes = editing ? (editing.times && editing.times.length ? editing.times.slice() : (editing.due ? [editing.due] : [])) : [];
  const exp = expediente(unitTurnos());
  const es = (editing && editing.schedule) || {};
  const turnoIdx = activeTurnos(unitTurnos()).slice(0, 1).map(t => t.idx); // padrão: só o 1º turno
  window.__when = editing && editing.schedule
    ? { type: editing.schedule.type || 'fixos', every: editing.schedule.every || 2, unit: editing.schedule.unit || 'horas', count: editing.schedule.count || 2, period: editing.schedule.period || 'dia', moments: new Set(editing.schedule.moments || []), noTime: !!es.semHorario || (es.type === 'fixos' && !(es.times && es.times.length) && !(editing.times && editing.times.length) && !editing.due), start: es.start || exp.start, end: es.end || exp.end, useExp: !(es.start || es.end), turnos: new Set(es.turnos && es.turnos.length ? es.turnos : turnoIdx), days: (editing.schedule.days || editing.days || []).slice(), toleranceMin: editing.toleranceMin || 0 }
    : { type: 'fixos', every: 2, unit: 'horas', count: 2, period: 'dia', moments: new Set(), noTime: false, start: exp.start, end: exp.end, useExp: true, turnos: new Set(turnoIdx), days: [], toleranceMin: 0 };

  const inner = `<div class="px-4 py-4 space-y-4 pb-8">
    <div class="flex items-center justify-between">
      <button data-action="nav" data-nav="ge_forms" class="tap inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">${icon('arrow_back', 'text-[18px]')} Voltar para PACs</button>
      ${editing ? `<button data-action="delete-form" data-form="${editing.id}" class="tap w-9 h-9 rounded-lg flex items-center justify-center text-error">${icon('delete', 'text-[20px]')}</button>` : ''}
    </div>
    <h1 class="text-[22px] font-bold text-on-surface leading-tight">${editing ? 'Configurar Planilha' : 'Nova Planilha'}</h1>

    <section class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl overflow-hidden">
      <button type="button" data-toggle-section="ident" class="tap w-full flex items-center justify-between gap-2 p-4">
        <div class="flex items-center gap-2">${icon('badge', 'text-secondary text-[18px]', true)}<h2 class="mono text-[11px] uppercase tracking-widest text-on-surface font-semibold">Identificação Normativa</h2></div>
        <span class="material-symbols-outlined text-on-surface-variant text-[20px]" data-chevron>expand_less</span>
      </button>
      <div class="px-4 pb-4 space-y-3" data-section-body="ident">
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Título do Documento</label>
        <input id="ed-title" value="${editing ? esc(editing.title) : ''}" placeholder="Ex: Controle Diário de Cloração" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
        <div class="bg-surface-container-low rounded-lg p-3"><div class="mono text-[10px] uppercase text-on-surface-variant">PAC Vinculado</div><div class="text-[13px] font-bold text-on-surface">${pac.code} · ${esc(pac.name)}</div></div>
        <div class="flex items-center justify-between bg-surface-container-low rounded-lg px-3 py-2.5">
          <div><div class="mono text-[10px] uppercase text-on-surface-variant">Código da Planilha</div><div class="mono text-[13px] font-bold text-on-surface">PL ${String(editing ? editing.plNum : nextPlNum(pac.id)).padStart(2, '0')}</div></div>
          <div class="text-right"><div class="mono text-[10px] uppercase text-on-surface-variant">${editing ? 'Ao publicar' : 'Revisão'}</div><div class="mono text-[13px] font-bold ${editing ? 'text-tertiary' : 'text-secondary'}">${editing ? 'Rev. ' + String((editing.rev || 1) + 1).padStart(2, '0') : 'Rev. 01'}</div></div>
        </div>
        ${editing ? `<div class="flex items-center gap-1.5 text-[11px] text-on-surface-variant">${icon('history', 'text-[15px]')} Vigente: ${revLabel(editing)} · a versão anterior fica arquivada na auditoria.</div>` : ''}
      </div>
    </section>

    <section class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl overflow-hidden">
      <button type="button" data-toggle-section="freq" class="tap w-full flex items-center justify-between gap-2 p-4">
        <div class="flex items-center gap-2">${icon('schedule', 'text-secondary text-[18px]', true)}<h2 class="mono text-[11px] uppercase tracking-widest text-on-surface font-semibold">Frequência & Coleta</h2></div>
        <span class="material-symbols-outlined text-on-surface-variant text-[20px]" data-chevron>expand_less</span>
      </button>
      <div class="px-4 pb-4 space-y-3" data-section-body="freq">
        <div id="ed-when-wrap"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Local / Ponto de Coleta</label><input id="ed-loc" value="${editing ? esc(editing.location) : ''}" placeholder="Ex: Reservatório Central" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
      </div>
    </section>

    <section class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl overflow-hidden">
      <button type="button" data-toggle-section="params" class="tap w-full flex items-center justify-between gap-2 p-4">
        <div class="flex items-center gap-2">${icon('tune', 'text-secondary text-[18px]', true)}<h2 class="mono text-[11px] uppercase tracking-widest text-on-surface font-semibold">Parâmetros e Limites Críticos</h2></div>
        <span class="material-symbols-outlined text-on-surface-variant text-[20px]" data-chevron>expand_less</span>
      </button>
      <div class="px-4 pb-4 space-y-3" data-section-body="params">
        <div id="ed-params" class="space-y-3"></div>
        <button data-action="add-param" class="tap w-full flex items-center justify-center gap-1.5 bg-surface-container text-primary rounded-lg py-2.5 font-semibold text-[13px]">${icon('add_circle', 'text-[18px]', true)} Adicionar Parâmetro</button>
      </div>
    </section>

    <button data-action="save-form" class="tap w-full bg-primary text-on-primary rounded-xl py-4 font-semibold flex items-center justify-center gap-2 text-[15px]">${editing ? 'Salvar e Publicar Rev. ' + String((editing.rev || 1) + 1).padStart(2, '0') : 'Criar Planilha'}</button>
    <p class="text-center text-[11px] text-on-surface-variant">${editing ? 'Publicar cria uma nova revisão; a anterior é arquivada para auditoria.' : 'O código PL é gerado automaticamente e sequencial ao publicar.'}</p>
  </div>`;
  app().innerHTML = shell(inner, GE_NAV, 'ge_forms', profileTrigger());
  renderEditorParams();
  renderWhen();
  document.querySelectorAll('[data-toggle-section]').forEach(btn => {
    btn.onclick = () => {
      const body = document.querySelector(`[data-section-body="${btn.dataset.toggleSection}"]`);
      const chev = btn.querySelector('[data-chevron]');
      const nowHidden = body.classList.toggle('hidden');
      chev.textContent = nowHidden ? 'expand_more' : 'expand_less';
    };
  });
}

export function renderWhen() {
  const wrap = $('ed-when-wrap'); if (!wrap) return;
  const w = window.__when;
  const typeBtn = (v, label, ic) => `<button data-action="when-type" data-type="${v}" class="tap flex items-center justify-center gap-1 py-2 rounded-lg text-[12px] font-semibold ${w.type === v ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}">${icon(ic, 'text-[16px]')} ${label}</button>`;
  let body = '';
  if (w.type === 'fixos') {
    // "sem horário específico": 1 registro por dia, a qualquer hora, sem prazo/atraso
    body = `<div class="flex items-center gap-3">
        <span id="ed-notime" class="toggle ${w.noTime ? 'on' : ''} flex-none cursor-pointer"></span>
        <span class="text-[13px] text-on-surface">Sem horário específico</span>
      </div>
      ${w.noTime ? `<p class="text-[11px] text-on-surface-variant mt-2">1 registro por dia, a qualquer hora — não fica atrasada.</p>` : `<div id="ed-times" class="flex flex-wrap gap-2 mt-3"></div>
      <button data-action="add-time" class="tap mt-2 inline-flex items-center gap-1 text-primary font-semibold text-[13px]">${icon('add', 'text-[18px]')} Adicionar horário</button>
      ${toleranceBlock(w)}`}`;
  } else if (w.type === 'intervalo') {
    body = `<div class="flex items-center gap-2">
      <span class="text-[13px] text-on-surface">A cada</span>
      <input id="ed-every" type="number" min="1" value="${w.every}" class="w-16 bg-surface-container-low rounded-lg px-3 py-2 mono text-[15px] text-on-surface text-center border border-transparent focus:border-primary">
      <select id="ed-unit" class="bg-surface-container-low rounded-lg px-3 py-2 text-[13px] font-semibold text-on-surface border border-transparent focus:border-primary"><option value="horas" ${w.unit === 'horas' ? 'selected' : ''}>horas</option><option value="minutos" ${w.unit === 'minutos' ? 'selected' : ''}>minutos</option></select>
    </div>${windowBlock(w)}`;
  } else if (w.type === 'vezes') {
    body = `<div class="flex items-center gap-2 flex-wrap">
      <input id="ed-count" type="number" min="1" value="${w.count}" class="w-16 bg-surface-container-low rounded-lg px-3 py-2 mono text-[15px] text-on-surface text-center border border-transparent focus:border-primary">
      <span class="text-[13px] text-on-surface">vez(es) por</span>
      <select id="ed-period" class="bg-surface-container-low rounded-lg px-3 py-2 text-[13px] font-semibold text-on-surface border border-transparent focus:border-primary"><option value="dia" ${w.period === 'dia' ? 'selected' : ''}>dia</option><option value="semana" ${w.period === 'semana' ? 'selected' : ''}>semana</option><option value="mes" ${w.period === 'mes' ? 'selected' : ''}>mês</option></select>
    </div>${w.period === 'dia' ? windowBlock(w) : `<p class="text-[11px] text-on-surface-variant mt-2">Quantidade sem horário fixo — 1 registro por dia, sem prazo.</p>`}`;
  } else if (w.type === 'momentos') {
    const mo = (v, label) => { const on = w.moments.has(v); return `<button data-action="when-moment" data-m="${v}" class="tap w-full flex items-center justify-between px-3 py-2.5 rounded-lg ${on ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-low text-on-surface'}"><span class="text-[13px] font-medium">${label}</span><span class="material-symbols-outlined ${on ? 'ms-fill text-secondary' : 'text-outline-variant'} text-[20px]">${on ? 'check_circle' : 'radio_button_unchecked'}</span></button>`; };
    const act = activeTurnos(unitTurnos()), multi = act.length > 1;
    const chip = t => { const on = w.turnos.has(t.idx); return `<button data-when-turno="${t.idx}" class="tap flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold ${on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}">${t.idx + 1}º turno <span class="mono font-normal opacity-80">${t.inicio}–${t.fim}</span></button>`; };
    body = `<div class="space-y-2">${mo('inicio', multi ? 'Início do turno' : 'Início do expediente')}${mo('fim', multi ? 'Fim do turno' : 'Fim do expediente')}</div>
      ${multi ? `<label class="mono text-[10px] uppercase text-on-surface-variant block mt-3">Em quais turnos</label><div class="flex gap-2 mt-1">${act.map(chip).join('')}</div>` : ''}
      ${toleranceBlock(w)}
      <p id="ed-slot-preview" class="text-[11px] text-on-surface-variant mt-2"></p>`;
  } else {
    body = `<div class="flex items-start gap-2 bg-surface-container-low rounded-lg p-3 text-[12px] text-on-surface-variant">${icon('bolt', 'text-[18px] flex-none')}<span>Sem horário específico — preenchida quando houver demanda.</span></div>`;
  }
  const daysBlock = w.type === 'demanda' ? '' : `<div class="mt-4"><label class="mono text-[10px] uppercase text-on-surface-variant">Dias</label>
    <div class="flex items-center gap-1.5 mt-1 flex-wrap">
      <button data-when-alldays class="ad-btn tap text-[12px] font-semibold px-3 py-1.5 rounded-lg">Todos os dias</button>
      <span class="w-px h-6 bg-outline-variant/50 mx-0.5"></span>
      ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => `<button data-when-day="${i}" class="wday-btn tap w-8 h-8 rounded-lg font-semibold text-[13px]">${d}</button>`).join('')}
    </div></div>`;
  wrap.innerHTML = `<label class="mono text-[10px] uppercase text-on-surface-variant">Quando preencher</label>
    <div class="grid grid-cols-3 gap-2 mt-1">${typeBtn('fixos', 'Fixos', 'schedule')}${typeBtn('intervalo', 'A cada', 'timelapse')}${typeBtn('vezes', 'Vezes', 'repeat')}${typeBtn('momentos', 'Momentos', 'flag')}${typeBtn('demanda', 'Demanda', 'bolt')}</div>
    <div class="mt-3">${body}</div>${daysBlock}`;
  if (w.type === 'fixos' && !w.noTime) renderEditorTimes();
  const nt = $('ed-notime'); if (nt) nt.onclick = () => { syncWhen(); w.noTime = !w.noTime; renderWhen(); };
  ['ed-unit', 'ed-period'].forEach(id => { const el = $(id); if (el) el.onchange = () => { syncWhen(); renderWhen(); }; });
  document.querySelectorAll('[data-when-turno]').forEach(b => b.onclick = () => {
    syncWhen(); const i = +b.dataset.whenTurno;
    if (w.turnos.has(i)) { if (w.turnos.size > 1) w.turnos.delete(i); } else w.turnos.add(i);
    renderWhen();
  });
  const ue = $('ed-useexp'); if (ue) ue.onclick = () => { syncWhen(); w.useExp = !w.useExp; if (w.useExp) { const e = expediente(unitTurnos()); w.start = e.start; w.end = e.end; } renderWhen(); };
  ['ed-every', 'ed-count', 'ed-start', 'ed-end'].forEach(id => { const el = $(id); if (el) el.oninput = () => { syncWhen(); paintSlotPreview(); }; });
  paintSlotPreview();
  function paintDays() {
    const all = w.days.length === 0;
    document.querySelectorAll('.ad-btn').forEach(b => b.className = 'ad-btn tap text-[12px] font-semibold px-3 py-1.5 rounded-lg ' + (all ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'));
    document.querySelectorAll('.wday-btn').forEach(b => { const i = +b.dataset.whenDay; const on = !all && w.days.includes(i); b.className = 'wday-btn tap w-8 h-8 rounded-lg font-semibold text-[13px] ' + (on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'); });
  }
  document.querySelectorAll('.ad-btn').forEach(b => b.onclick = () => { w.days = []; paintDays(); });
  document.querySelectorAll('.wday-btn').forEach(b => b.onclick = () => { const i = +b.dataset.whenDay; const k = w.days.indexOf(i); if (k >= 0) w.days.splice(k, 1); else w.days.push(i); paintDays(); });
  paintDays();
}

export function syncWhen() {
  const w = window.__when;
  if (w.type === 'fixos') { syncEditorTimes(); const t = $('ed-tolerance'); if (t) w.toleranceMin = Math.max(0, parseInt(t.value, 10) || 0); }
  else if (w.type === 'intervalo') { const e = $('ed-every'), u = $('ed-unit'); if (e) w.every = Math.max(1, parseInt(e.value) || 1); if (u) w.unit = u.value; }
  else if (w.type === 'vezes') { const c = $('ed-count'), pd = $('ed-period'); if (c) w.count = Math.max(1, parseInt(c.value) || 1); if (pd) w.period = pd.value; }
  const st = $('ed-start'), en = $('ed-end'), tol = $('ed-tolerance');
  if (st && st.value) w.start = st.value;
  if (en && en.value) w.end = en.value;
  if (tol) w.toleranceMin = Math.max(0, parseInt(tol.value, 10) || 0);
}

function toleranceBlock(w) {
  return `<div class="flex items-center gap-2 mt-3">
        <span class="text-[13px] text-on-surface">Tolerância de</span>
        <input id="ed-tolerance" type="number" min="0" value="${w.toleranceMin}" class="w-16 bg-surface-container-low rounded-lg px-3 py-2 mono text-[15px] text-on-surface text-center border border-transparent focus:border-primary">
        <span class="text-[13px] text-on-surface">minutos antes de marcar como atrasada</span>
      </div>`;
}

// janela do dia (início/fim) pra "a cada X horas" e "N vezes ao dia": é o que transforma
// a frequência em horários concretos, cada um com seu próprio registro.
function windowBlock(w) {
  const inp = (id, v) => `<input id="${id}" type="time" step="300" value="${esc(v)}" class="bg-surface-container-low rounded-lg px-3 py-2 mono text-[15px] text-on-surface border border-transparent focus:border-primary">`;
  const exp = expediente(unitTurnos());
  return `<div class="flex items-center gap-3 mt-3">
      <span id="ed-useexp" class="toggle ${w.useExp ? 'on' : ''} flex-none cursor-pointer"></span>
      <span class="text-[13px] text-on-surface">Seguir o expediente <span class="mono text-on-surface-variant">(${exp.start}–${exp.end})</span></span>
    </div>
    ${w.useExp ? '' : `<div class="flex items-center gap-2 mt-3 flex-wrap">
      <span class="text-[13px] text-on-surface">Das</span>${inp('ed-start', w.start)}
      <span class="text-[13px] text-on-surface">às</span>${inp('ed-end', w.end)}
    </div>`}
    ${toleranceBlock(w)}
    <p id="ed-slot-preview" class="text-[11px] text-on-surface-variant mt-2"></p>`;
}

// sem start/end = segue o expediente da unidade (muda junto se os turnos mudarem)
function whenSchedule(w) {
  const win = w.useExp ? {} : { start: w.start, end: w.end };
  if (w.type === 'intervalo') return { type: 'intervalo', every: w.every, unit: w.unit, ...win };
  if (w.type === 'vezes') return { type: 'vezes', count: w.count, period: w.period, ...win };
  if (w.type === 'momentos') return { type: 'momentos', moments: [...w.moments], turnos: [...w.turnos].sort() };
  return null;
}

function paintSlotPreview() {
  const el = $('ed-slot-preview'); if (!el) return;
  const w = window.__when;
  if (w.type !== 'momentos' && !w.useExp && !(toMin(w.end) > toMin(w.start))) { el.innerHTML = `<span class="text-error font-semibold">O fim precisa ser depois do início.</span>`; return; }
  const sch = whenSchedule(w);
  const slots = daySlots(sch, [], '', unitTurnos());
  if (w.type === 'momentos') {
    const labels = slotLabels(sch, [], '', unitTurnos());
    el.textContent = slots.map(t => `${labels[t]} (${t})`).join(' · ');
    return;
  }
  const shown = slots.length > 12 ? slots.slice(0, 12).join(', ') + ', …' : slots.join(', ');
  el.textContent = `${slots.length} registro${slots.length === 1 ? '' : 's'} por dia: ${shown}`;
}

function timeSelect(kind, val, i) {
  const opts = kind === 'h' ? Array.from({ length: 24 }, (_, n) => n) : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  return `<select data-t${kind}="${i}" class="ed-t${kind} appearance-none bg-transparent mono text-[15px] font-semibold text-on-surface text-center cursor-pointer focus:outline-none">
    <option value="" ${val === '' ? 'selected' : ''}>--</option>
    ${opts.map(n => `<option value="${n}" ${String(n) === String(val) ? 'selected' : ''}>${String(n).padStart(2, '0')}</option>`).join('')}
  </select>`;
}

export function renderEditorTimes() {
  const wrap = $('ed-times'); if (!wrap) return;
  if (!window.__editorTimes.length) { wrap.innerHTML = `<span class="text-[12px] text-on-surface-variant py-1">Nenhum horário definido.</span>`; return; }
  wrap.innerHTML = window.__editorTimes.map((t, i) => {
    const parts = (t || '').split(':'); const hv = parts[0] !== undefined && parts[0] !== '' ? parseInt(parts[0], 10) : ''; const mv = parts[1] !== undefined && parts[1] !== '' ? parseInt(parts[1], 10) : '';
    return `<span class="inline-flex items-center gap-0.5 bg-surface-container-low rounded-lg pl-2 pr-1 py-1.5 border border-transparent focus-within:border-primary">
      ${icon('schedule', 'text-on-surface-variant text-[16px]')}
      ${timeSelect('h', hv, i)}<span class="mono text-[15px] font-semibold text-on-surface-variant">:</span>${timeSelect('m', mv, i)}
      <button data-action="del-time" data-idx="${i}" class="tap w-6 h-6 rounded flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[16px]')}</button>
    </span>`;
  }).join('');
}

export function syncEditorTimes() {
  window.__editorTimes.forEach((_, i) => {
    const hs = document.querySelector(`.ed-th[data-th="${i}"]`), ms = document.querySelector(`.ed-tm[data-tm="${i}"]`);
    if (!hs || !ms) return;
    window.__editorTimes[i] = (hs.value !== '' && ms.value !== '') ? String(hs.value).padStart(2, '0') + ':' + String(ms.value).padStart(2, '0') : '';
  });
}

const PARAM_TYPES = [
  ['numeric', 'Mín/Máx', 'straighten', 'Medição numérica com faixa aceitável'],
  ['numero', 'Número Livre', 'tag', 'Registra um número, sem faixa nem avaliação'],
  ['qualitative', 'Conformidade', 'verified', 'O operador marca Conforme ou Não Conforme'],
  ['texto', 'Texto', 'notes', 'Resposta livre, sem avaliação'],
  ['simnao', 'Sim/Não', 'help', 'Pergunta neutra, sem julgar certo ou errado'],
  ['data', 'Data', 'calendar_today', 'Data de um evento específico (ex: início do reparo) — diferente da data do envio, que já fica registrada sozinha'],
  ['hora', 'Hora', 'schedule', 'Horário de um evento específico (ex: término do reparo) — diferente do horário do envio, que já fica registrado sozinho'],
  ['escolha', 'Múltipla Escolha', 'checklist', 'Você define as opções; pode marcar quais contam como não conformidade'],
];
const paramTypeInfo = (type) => PARAM_TYPES.find(([v]) => v === type) || PARAM_TYPES[1];

function defaultParamFields(type) {
  if (type === 'numeric') return { unit: '', min: 0, max: 0, step: 0.1, seed: 0 };
  if (type === 'numero') return { unit: '', step: 1, seed: 0 };
  if (type === 'qualitative') return { good: 'Conforme' };
  if (type === 'escolha') return { options: ['Opção 1', 'Opção 2'], ncOptions: [] };
  return {};
}

// sheet de escolha de tipo — abre tanto pro "+ Adicionar Parâmetro" (targetIndex -1,
// cria um parâmetro novo) quanto pra trocar o tipo de um já existente (mantém nome e id).
function openParamTypePicker(targetIndex) {
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-end sm:items-center justify-center" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[420px] max-h-[80dvh] overflow-y-auto scroll-area shadow-2xl p-4 sheet-enter">
      <div class="flex items-center justify-between pb-3 border-b border-outline-variant/40">
        <div class="font-semibold text-on-surface text-[16px]">Tipo de parâmetro</div>
        <button data-action="close-x" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
      </div>
      <div class="space-y-1 mt-2">
        ${PARAM_TYPES.map(([v, label, ic, desc]) => `<button data-pick-type="${v}" class="tap w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-surface-container">
          <span class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-none">${icon(ic, 'text-primary text-[20px]', true)}</span>
          <div class="flex-1 min-w-0"><div class="font-semibold text-on-surface text-[14px]">${label}</div><div class="text-[11px] text-on-surface-variant">${desc}</div></div>
        </button>`).join('')}
      </div>
    </div></div>`;
  $('modal-root').querySelectorAll('[data-pick-type]').forEach(b => b.onclick = () => {
    syncEditorParams();
    const type = b.dataset.pickType;
    if (targetIndex === -1) {
      window.__editorParams.push({ id: 'np' + Date.now() + Math.random().toString(36).slice(2, 6), type, name: '', required: true, ...defaultParamFields(type) });
    } else {
      const p = window.__editorParams[targetIndex];
      Object.keys(defaultParamFields(p.type)).forEach(k => delete p[k]);
      Object.assign(p, defaultParamFields(type));
      p.type = type;
    }
    closeModal();
    renderEditorParams();
  });
}
export function openAddParam() { openParamTypePicker(-1); }

function paramTypeBody(p) {
  if (p.type === 'numeric') return `
      <div class="grid grid-cols-2 gap-2">
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Mínimo</label><input data-pmin type="number" step="0.1" placeholder="0.5" value="${p.min || ''}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 mono text-[13px] border border-transparent focus:border-primary"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Máximo</label><input data-pmax type="number" step="0.1" placeholder="2.0" value="${p.max || ''}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 mono text-[13px] border border-transparent focus:border-primary"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Incremento (+/-)</label><input data-pstep type="number" step="0.1" min="0.01" placeholder="0.1" value="${p.step || 0.1}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 mono text-[13px] border border-transparent focus:border-primary"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Unidade</label><input data-punit placeholder="ppm" value="${esc(p.unit)}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 mono text-[13px] border border-transparent focus:border-primary"></div>
      </div>`;

  if (p.type === 'numero') return `
      <div class="grid grid-cols-2 gap-2">
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Incremento (+/-)</label><input data-pstep type="number" step="0.1" min="0.01" placeholder="1" value="${p.step || 1}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 mono text-[13px] border border-transparent focus:border-primary"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Unidade (opcional)</label><input data-punit placeholder="unid." value="${esc(p.unit)}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 mono text-[13px] border border-transparent focus:border-primary"></div>
      </div>
      <p class="text-[11px] text-on-surface-variant">Registra o número que o operador digitar — sem faixa mínima/máxima nem avaliação de conformidade.</p>`;

  if (p.type === 'texto') return `
      <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-3">
        <div class="mono text-[10px] text-on-surface-variant">Resposta do operador</div>
        <div class="h-8 border-b border-dashed border-outline-variant mt-1"></div>
      </div>
      <p class="text-[11px] text-on-surface-variant">O operador escreve uma resposta curta — não conta como não conformidade.</p>`;

  if (p.type === 'simnao') return `
      <div class="grid grid-cols-2 gap-2">
        <div class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface font-semibold text-[13px]">${icon('check', 'text-[16px]')} Sim</div>
        <div class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface font-semibold text-[13px]">${icon('close', 'text-[16px]')} Não</div>
      </div>
      <p class="text-[11px] text-on-surface-variant">Pergunta neutra — qualquer resposta conta como preenchida, sem gerar não conformidade.</p>`;

  if (p.type === 'data') return `
      <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-3 flex items-center gap-2">
        ${icon('calendar_today', 'text-on-surface-variant text-[16px]')}<span class="mono text-[12px] text-on-surface-variant">dd/mm/aaaa</span>
      </div>
      <p class="text-[11px] text-on-surface-variant">Use pra data de um evento (ex: início de um reparo) — não pra "quando preencheu", isso já é registrado sozinho.</p>`;

  if (p.type === 'hora') return `
      <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-3 flex items-center gap-2">
        ${icon('schedule', 'text-on-surface-variant text-[16px]')}<span class="mono text-[12px] text-on-surface-variant">hh:mm</span>
      </div>
      <p class="text-[11px] text-on-surface-variant">Use pra horário de um evento (ex: término de um reparo) — não pra "quando preencheu", isso já é registrado sozinho.</p>`;

  if (p.type === 'escolha') {
    const options = p.options && p.options.length ? p.options : ['Opção 1', 'Opção 2'];
    const ncOptions = p.ncOptions || [];
    return `
      <div class="space-y-1.5" data-opts>
        ${options.map((op, oi) => `<div class="flex items-center gap-2" data-opt-row="${oi}">
          <input data-opt-val value="${esc(op)}" placeholder="Opção ${oi + 1}" class="flex-1 bg-surface-container-low rounded-lg px-3 py-2 text-[13px] border border-transparent focus:border-primary">
          <button type="button" data-opt-nc class="tap flex-none mono text-[9px] font-semibold uppercase px-2 py-1.5 rounded ${ncOptions.includes(op) ? 'bg-nc-bg text-nc-tx' : 'bg-surface-container text-on-surface-variant'}">Não conf.</button>
          ${options.length > 2 ? `<button type="button" data-opt-del class="tap flex-none text-on-surface-variant">${icon('close', 'text-[18px]')}</button>` : ''}
        </div>`).join('')}
      </div>
      <button type="button" data-opt-add class="tap inline-flex items-center gap-1 text-primary font-semibold text-[13px]">${icon('add', 'text-[18px]')} Adicionar opção</button>
      <p class="text-[11px] text-on-surface-variant">O operador escolhe uma das opções. Marque "Não conf." nas que devem contar como não conformidade (ex.: "NC" em C/NC/NA).</p>`;
  }

  // qualitative (Conformidade)
  const hasCustomGood = !!p.good && p.good !== 'Conforme';
  return `
      <div class="grid grid-cols-2 gap-2">
        <div class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-conf-bg text-conf-tx font-semibold text-[13px]">${icon('check_circle', 'text-[16px]', true)}<span data-preview-good>${esc(p.good || 'Conforme')}</span></div>
        <div class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-nc-bg text-nc-tx font-semibold text-[13px]">${icon('cancel', 'text-[16px]', true)} Não Conf.</div>
      </div>
      <p class="text-[11px] text-on-surface-variant">É assim que o operador marca essa medição — sem digitar nada.</p>
      <button type="button" data-toggle-good class="${hasCustomGood ? 'hidden' : ''} text-[12px] font-semibold text-primary">Personalizar texto de "conforme"</button>
      <div data-good-custom class="${hasCustomGood ? '' : 'hidden'}">
        <label class="mono text-[10px] uppercase text-on-surface-variant">Texto quando conforme</label>
        <input data-pgood placeholder="Conforme" value="${esc(p.good || 'Conforme')}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 text-[13px] border border-transparent focus:border-primary">
      </div>`;
}

export function renderEditorParams() {
  const wrap = $('ed-params'); if (!wrap) return;
  wrap.innerHTML = window.__editorParams.map((p, i) => {
    const [, typeLabel, typeIcon] = paramTypeInfo(p.type);
    const required = p.required !== false;
    return `<div class="border border-outline-variant/60 rounded-xl p-4 space-y-3" data-pidx="${i}">
    <div class="flex items-center justify-between gap-2">
      <button type="button" data-change-type class="tap flex items-center gap-1.5 bg-surface-container text-on-surface rounded-lg pl-2 pr-1.5 py-1.5">
        ${icon(typeIcon, 'text-primary text-[16px]', true)}<span class="mono text-[10px] font-semibold">${typeLabel}</span>${icon('expand_more', 'text-on-surface-variant text-[16px]')}
      </button>
      <div class="flex items-center gap-3 flex-none">
        <label class="flex items-center gap-1.5 text-[11px] text-on-surface-variant"><span data-required-toggle class="toggle ${required ? 'on' : ''}"></span>Obrigatório</label>
        ${window.__editorParams.length > 1 ? `<button data-del-param class="tap text-error flex-none">${icon('delete', 'text-[18px]')}</button>` : ''}
      </div>
    </div>
    <div><label class="mono text-[10px] uppercase text-on-surface-variant">Título</label>
      <input data-pname placeholder="Ex: Cloro Livre" value="${esc(p.name)}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] font-semibold text-on-surface border border-transparent focus:border-primary"></div>
    ${paramTypeBody(p)}
  </div>`;
  }).join('');
  wrap.querySelectorAll('[data-pidx]').forEach(box => {
    const i = +box.dataset.pidx;
    const changeType = box.querySelector('[data-change-type]');
    if (changeType) changeType.onclick = () => { syncEditorParams(); openParamTypePicker(i); };
    const reqToggle = box.querySelector('[data-required-toggle]');
    if (reqToggle) reqToggle.onclick = () => {
      const p = window.__editorParams[i];
      p.required = !(p.required !== false);
      reqToggle.classList.toggle('on', p.required);
    };
    const del = box.querySelector('[data-del-param]'); if (del) del.onclick = () => { syncEditorParams(); window.__editorParams.splice(i, 1); renderEditorParams(); };
    const goodInput = box.querySelector('[data-pgood]'), goodPreview = box.querySelector('[data-preview-good]');
    if (goodInput) goodInput.oninput = () => { goodPreview.textContent = goodInput.value.trim() || 'Conforme'; };
    const toggleGood = box.querySelector('[data-toggle-good]'), goodCustom = box.querySelector('[data-good-custom]');
    if (toggleGood) toggleGood.onclick = () => { toggleGood.classList.add('hidden'); goodCustom.classList.remove('hidden'); goodInput.focus(); };

    const addOpt = box.querySelector('[data-opt-add]');
    if (addOpt) addOpt.onclick = () => {
      syncEditorParams();
      const p = window.__editorParams[i];
      p.options.push('Opção ' + (p.options.length + 1));
      renderEditorParams();
    };
    box.querySelectorAll('[data-opt-del]').forEach((b, oi) => b.onclick = () => {
      syncEditorParams();
      const p = window.__editorParams[i];
      const removed = p.options.splice(oi, 1)[0];
      p.ncOptions = (p.ncOptions || []).filter(o => o !== removed);
      renderEditorParams();
    });
    box.querySelectorAll('[data-opt-nc]').forEach((b, oi) => b.onclick = () => {
      syncEditorParams();
      const p = window.__editorParams[i];
      const val = p.options[oi];
      p.ncOptions = p.ncOptions || [];
      const k = p.ncOptions.indexOf(val);
      if (k >= 0) p.ncOptions.splice(k, 1); else p.ncOptions.push(val);
      renderEditorParams();
    });
  });
}

export function syncEditorParams() {
  document.querySelectorAll('#ed-params [data-pidx]').forEach(box => {
    const i = +box.dataset.pidx, p = window.__editorParams[i];
    p.name = box.querySelector('[data-pname]').value;
    if (p.type === 'numeric') {
      p.min = parseFloat(box.querySelector('[data-pmin]').value) || 0; p.max = parseFloat(box.querySelector('[data-pmax]').value) || 0;
      p.unit = box.querySelector('[data-punit]').value; p.step = parseFloat(box.querySelector('[data-pstep]').value) || 0.1; p.seed = p.min;
    } else if (p.type === 'numero') {
      p.unit = box.querySelector('[data-punit]').value; p.step = parseFloat(box.querySelector('[data-pstep]').value) || 1; p.seed = 0;
    } else if (p.type === 'escolha') {
      const oldOptions = p.options || [];
      const rows = [...box.querySelectorAll('[data-opt-row]')];
      const newOptions = rows.map(r => r.querySelector('[data-opt-val]').value.trim() || 'Opção');
      // remapeia quais estavam marcadas "não conforme" pro novo texto da mesma posição
      p.ncOptions = (p.ncOptions || []).map(nc => { const idx = oldOptions.indexOf(nc); return idx >= 0 && newOptions[idx] ? newOptions[idx] : nc; }).filter(nc => newOptions.includes(nc));
      p.options = newOptions;
    } else if (p.type === 'qualitative') {
      p.good = box.querySelector('[data-pgood]').value || 'Conforme';
    }
    // texto, simnao, data e hora não têm campos extras além do título
  });
}

export async function saveFormEditor() {
  syncEditorParams(); syncWhen();
  const title = $('ed-title').value.trim();
  if (!title) { toast('Informe o título do documento.', 'err'); return; }
  if (window.__editorParams.some(p => !p.name.trim())) { toast('Todo parâmetro precisa de um nome.', 'err'); return; }
  const w = window.__when;
  const days = (w.days || []).slice().sort();
  let times = [], due = '', schedule;
  if (w.type === 'fixos' && w.noTime) { schedule = { type: 'fixos', times: [], semHorario: true, days }; }
  else if (w.type === 'fixos') { times = window.__editorTimes.filter(Boolean).sort(); if (!times.length) { toast('Adicione ao menos um horário.', 'err'); return; } due = times[0] || ''; schedule = { type: 'fixos', times, days }; }
  else if (w.type === 'intervalo' || w.type === 'vezes') {
    schedule = { ...whenSchedule(w), days };
    if (usesWindow(schedule) && !w.useExp && !(toMin(w.end) > toMin(w.start))) { toast('O horário de fim precisa ser depois do início.', 'err'); return; }
  }
  else if (w.type === 'momentos') { if (!w.moments.size) { toast('Selecione ao menos um momento.', 'err'); return; } schedule = { ...whenSchedule(w), days }; }
  else { schedule = { type: 'demanda' }; }

  const editing = params.form ? getForm(params.form) : null;
  const loc = $('ed-loc').value.trim() || 'A definir';
  const pac = editing ? getPac(editing.pacId) : getPac(params.pac || DB.pacs[0].id);
  const toleranceMin = ((w.type === 'fixos' && !w.noTime) || w.type === 'momentos' || usesWindow(schedule)) ? (w.toleranceMin || 0) : 0;
  const payload = { pacId: pac.id, title, due, schedule, days, times, location: loc, params: window.__editorParams, toleranceMin };

  const btn = document.querySelector('[data-action="save-form"]');
  if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }
  try {
    if (editing) {
      const saved = await api.updateForm(editing.id, payload);
      await api.refreshState();
      toast(`${saved.pacId ? '' : ''}PL ${String(saved.plNum).padStart(2, '0')} publicada como Rev. ${String(saved.rev).padStart(2, '0')} — versão anterior arquivada.`);
    } else {
      const saved = await api.createForm(payload);
      await api.refreshState();
      toast(`Planilha ${pac.code} · PL ${String(saved.plNum).padStart(2, '0')} criada (Rev. 01).`);
    }
    navigate('ge_pac_forms', { pac: pac.id });
  } catch (e) {
    toast(e.message || 'Não foi possível salvar a planilha.', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
  }
}

export function confirmDeleteForm(id) {
  const f = getForm(id); if (!f) return;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[380px] shadow-2xl p-5">
      <div class="flex items-center gap-2 mb-2">${icon('delete', 'text-error text-[24px]', true)}<div class="font-semibold text-on-surface text-[16px]">Excluir ${esc(f.title)}?</div></div>
      <p class="text-[13px] text-on-surface-variant mb-4">Só é possível excluir planilhas sem nenhum registro. Se já houver histórico, desative-a em vez de excluir.</p>
      <div class="flex gap-2">
        <button data-action="close-x" class="tap flex-1 bg-surface-container text-on-surface rounded-xl py-3 font-semibold text-[14px]">Cancelar</button>
        <button data-action="del-form-confirm" data-form="${f.id}" class="tap flex-1 bg-error text-on-error rounded-xl py-3 font-semibold text-[14px]">Excluir</button>
      </div>
    </div></div>`;
}

export async function deleteFormConfirmed(id) {
  const f = getForm(id); const pacId = f ? f.pacId : null;
  try {
    await api.deleteForm(id);
    await api.refreshState();
    closeModal();
    toast('Planilha excluída.');
    navigate('ge_pac_forms', { pac: pacId });
  } catch (e) { toast(e.message || 'Não foi possível excluir.', 'err'); }
}
