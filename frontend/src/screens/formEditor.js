import { $, esc, icon, toast } from '../helpers.js';
import { params, getForm, getPac, DB, nextPlNum, unitTurnos } from '../state.js';
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
  const allTurnoIdx = activeTurnos(unitTurnos()).map(t => t.idx);
  window.__when = editing && editing.schedule
    ? { type: editing.schedule.type || 'fixos', every: editing.schedule.every || 2, unit: editing.schedule.unit || 'horas', count: editing.schedule.count || 2, period: editing.schedule.period || 'dia', moments: new Set(editing.schedule.moments || []), noTime: !!es.semHorario || (es.type === 'fixos' && !(es.times && es.times.length) && !(editing.times && editing.times.length) && !editing.due), start: es.start || exp.start, end: es.end || exp.end, useExp: !(es.start || es.end), winTurnos: new Set(['intervalo', 'vezes'].includes(es.type) && es.turnos && es.turnos.length ? es.turnos : allTurnoIdx), turnos: new Set(es.turnos && es.turnos.length ? es.turnos : turnoIdx), days: (editing.schedule.days || editing.days || []).slice(), toleranceMin: editing.toleranceMin || 0 }
    : { type: 'fixos', every: 2, unit: 'horas', count: 2, period: 'dia', moments: new Set(), noTime: false, start: exp.start, end: exp.end, useExp: true, winTurnos: new Set(allTurnoIdx), turnos: new Set(turnoIdx), days: [], toleranceMin: 0 };

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
      </div>
    </section>

    <section class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl overflow-hidden">
      <button type="button" data-toggle-section="freq" class="tap w-full flex items-center justify-between gap-2 p-4">
        <div class="flex items-center gap-2">${icon('schedule', 'text-secondary text-[18px]', true)}<h2 class="mono text-[11px] uppercase tracking-widest text-on-surface font-semibold">Frequência & Coleta</h2></div>
        <span class="material-symbols-outlined text-on-surface-variant text-[20px]" data-chevron>expand_less</span>
      </button>
      <div class="px-4 pb-4" data-section-body="freq">
        <div id="ed-when-wrap"></div>
        <div class="mt-4 pt-4 border-t border-outline-variant/40">${lbl('Quem preenche')}
          <div class="grid grid-cols-2 gap-2">
            <button data-fill-mode="um" class="fill-mode-btn tap rounded-lg px-3 py-2 text-left"><div class="text-[13px] font-semibold">Basta um</div><div class="text-[11px] opacity-80">Ex.: cloro, temperatura</div></button>
            <button data-fill-mode="cada" class="fill-mode-btn tap rounded-lg px-3 py-2 text-left"><div class="text-[13px] font-semibold">Cada pessoa</div><div class="text-[11px] opacity-80">Ex.: saúde, uniforme</div></button>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-outline-variant/40">${lbl('Local / ponto de coleta')}<input id="ed-loc" value="${editing ? esc(editing.location) : ''}" placeholder="Ex: Reservatório Central" class="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
        <div id="ed-tol-wrap"></div>
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
  </div>`;
  app().innerHTML = shell(inner, GE_NAV, 'ge_forms', profileTrigger());
  renderEditorParams();
  // quem preenche: registro do processo/local (basta um; mais gente = cobertura) ou
  // registro sobre a própria pessoa (cada um envia o seu)
  window.__fillMode = editing && editing.fillMode === 'cada' ? 'cada' : 'um';
  const paintFill = () => {
    document.querySelectorAll('.fill-mode-btn').forEach(b => b.className = 'fill-mode-btn tap rounded-lg px-3 py-2 text-left ' + (b.dataset.fillMode === window.__fillMode ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'));
  };
  document.querySelectorAll('.fill-mode-btn').forEach(b => b.onclick = () => { window.__fillMode = b.dataset.fillMode; paintFill(); });
  paintFill();
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

// rótulo de bloco (mesmo estilo em toda a seção) e divisória entre blocos
const lbl = (t, right = '') => `<div class="flex items-center justify-between min-h-[20px] mb-2"><span class="mono text-[10px] uppercase tracking-wide text-on-surface-variant">${t}</span>${right}</div>`;
const group = inner => `<div class="mt-4 pt-4 border-t border-outline-variant/40">${inner}</div>`;
const fieldCls = 'bg-surface-container-low rounded-lg px-3 py-2 mono text-[15px] text-on-surface border border-transparent focus:border-primary';

export function renderWhen() {
  const wrap = $('ed-when-wrap'); if (!wrap) return;
  const w = window.__when;
  // 5 tipos sempre numa linha: ícone em cima, nome embaixo
  const typeBtn = (v, label, ic) => `<button data-action="when-type" data-type="${v}" class="tap flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-[11px] font-semibold ${w.type === v ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}">${icon(ic, 'text-[18px]')}${label}</button>`;
  const toggleRow = (id, on, text) => `<div class="flex items-center gap-3"><span id="${id}" class="toggle ${on ? 'on' : ''} flex-none cursor-pointer"></span><span class="text-[13px] text-on-surface">${text}</span></div>`;

  let config = '';
  if (w.type === 'fixos') {
    config = toggleRow('ed-notime', w.noTime, 'Sem horário específico')
      + (w.noTime ? '' : `<div id="ed-times" class="flex flex-wrap gap-2 mt-3"></div>`);
  } else if (w.type === 'intervalo') {
    config = `<div class="flex items-center gap-2">
      <span class="text-[13px] text-on-surface">A cada</span>
      <input id="ed-every" type="number" min="1" value="${w.every}" class="w-16 text-center ${fieldCls}">
      <select id="ed-unit" class="${fieldCls} !font-sans !text-[13px] font-semibold"><option value="horas" ${w.unit === 'horas' ? 'selected' : ''}>horas</option><option value="minutos" ${w.unit === 'minutos' ? 'selected' : ''}>minutos</option></select>
    </div>${windowBlock(w)}`;
  } else if (w.type === 'vezes') {
    config = `<div class="flex items-center gap-2 flex-wrap">
      <input id="ed-count" type="number" min="1" value="${w.count}" class="w-16 text-center ${fieldCls}">
      <span class="text-[13px] text-on-surface">vez(es) por</span>
      <select id="ed-period" class="${fieldCls} !font-sans !text-[13px] font-semibold"><option value="dia" ${w.period === 'dia' ? 'selected' : ''}>dia</option><option value="semana" ${w.period === 'semana' ? 'selected' : ''}>semana</option><option value="mes" ${w.period === 'mes' ? 'selected' : ''}>mês</option></select>
    </div>${w.period === 'dia' ? windowBlock(w) : ''}`;
  } else if (w.type === 'momentos') {
    const act = activeTurnos(unitTurnos()), multi = act.length > 1;
    const mo = (v, label) => { const on = w.moments.has(v); return `<button data-action="when-moment" data-m="${v}" class="tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold ${on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}">${icon(on ? 'check_circle' : 'radio_button_unchecked', 'text-[18px]')}${label}</button>`; };
    const chip = t => { const on = w.turnos.has(t.idx); return `<button data-when-turno="${t.idx}" class="tap flex-1 flex flex-col items-center py-2 rounded-lg text-[12px] font-semibold ${on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}">${t.idx + 1}º turno<span class="mono text-[10px] font-normal opacity-80">${t.inicio}–${t.fim}</span></button>`; };
    config = `<div class="flex gap-2">${mo('inicio', multi ? 'Início do turno' : 'Início do expediente')}${mo('fim', multi ? 'Fim do turno' : 'Fim do expediente')}</div>
      ${multi ? `<div class="flex gap-2 mt-2">${act.map(chip).join('')}</div>` : ''}`;
  } else {
    config = `<div class="flex items-center gap-2 bg-surface-container-low rounded-lg p-3 text-[12px] text-on-surface-variant">${icon('bolt', 'text-[18px] flex-none')}<span>Sem horário nem dia específico.</span></div>`;
  }

  // horários gerados (a cada / vezes ao dia / momentos) e tolerância: só quando há horário
  const generated = usesWindow(whenSchedule(w)) || w.type === 'momentos';
  const hasTimes = generated || (w.type === 'fixos' && !w.noTime);
  const horarios = generated ? group(lbl('Horários', `<span id="ed-slot-count" class="mono text-[10px] text-on-surface-variant"></span>`) + `<div id="ed-slot-preview" class="flex flex-wrap gap-1.5"></div>`) : '';
  const tolerancia = hasTimes ? group(lbl('Tolerância') + `<div class="flex items-center gap-2">
      <input id="ed-tolerance" type="number" min="0" value="${w.toleranceMin}" class="w-16 text-center ${fieldCls}">
      <span class="text-[13px] text-on-surface">min até marcar como atrasada</span></div>`) : '';
  const dias = w.type === 'demanda' ? '' : group(lbl('Dias', `<button data-when-alldays class="tap text-[12px] font-semibold text-primary px-2 py-0.5 rounded">Todos</button>`)
    + `<div class="grid grid-cols-7 gap-1.5">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => `<button data-when-day="${i}" class="wday-btn tap h-9 rounded-lg font-semibold text-[13px]">${d}</button>`).join('')}</div>`);

  wrap.innerHTML = lbl('Quando preencher')
    + `<div class="grid grid-cols-5 gap-1.5">${typeBtn('fixos', 'Fixos', 'schedule')}${typeBtn('intervalo', 'A cada', 'timelapse')}${typeBtn('vezes', 'Vezes', 'repeat')}${typeBtn('momentos', 'Momentos', 'flag')}${typeBtn('demanda', 'Demanda', 'bolt')}</div>
    <div class="mt-3">${config}</div>${horarios}${dias}`;
  const tw = $('ed-tol-wrap'); if (tw) tw.innerHTML = tolerancia; // fica embaixo do Local

  if (w.type === 'fixos' && !w.noTime) renderEditorTimes();
  const nt = $('ed-notime'); if (nt) nt.onclick = () => { syncWhen(); w.noTime = !w.noTime; renderWhen(); };
  ['ed-unit', 'ed-period'].forEach(id => { const el = $(id); if (el) el.onchange = () => { syncWhen(); renderWhen(); }; });
  document.querySelectorAll('[data-when-turno]').forEach(b => b.onclick = () => {
    syncWhen(); const i = +b.dataset.whenTurno;
    if (w.turnos.has(i)) { if (w.turnos.size > 1) w.turnos.delete(i); } else w.turnos.add(i);
    renderWhen();
  });
  document.querySelectorAll('[data-win-turno]').forEach(b => b.onclick = () => {
    syncWhen(); const i = +b.dataset.winTurno;
    if (!w.useExp) { w.useExp = true; w.winTurnos = new Set([i]); }
    else if (w.winTurnos.has(i)) { if (w.winTurnos.size > 1) w.winTurnos.delete(i); }
    else w.winTurnos.add(i);
    renderWhen();
  });
  const wc = document.querySelector('[data-win-custom]'); if (wc) wc.onclick = () => { syncWhen(); if (w.useExp) { const e = expediente(unitTurnos()); w.start = e.start; w.end = e.end; } w.useExp = false; renderWhen(); };
  ['ed-every', 'ed-count', 'ed-start', 'ed-end'].forEach(id => { const el = $(id); if (el) el.oninput = () => { syncWhen(); paintSlotPreview(); }; });
  // no celular, tocar no campo e digitar "3" com o "2" já lá virava "23x ao dia"
  ['ed-every', 'ed-count', 'ed-tolerance'].forEach(id => { const el = $(id); if (el) el.onfocus = () => el.select(); });
  paintSlotPreview();

  // dias: lista vazia = todos. Na tela, "todos" aparece com os 7 marcados; desmarcar um
  // deixa os outros 6. Não dá pra desmarcar o último (sem dia nenhum não faz sentido).
  function paintDays() {
    const all = w.days.length === 0;
    document.querySelectorAll('.wday-btn').forEach(b => { const i = +b.dataset.whenDay; const on = all || w.days.includes(i); b.className = 'wday-btn tap h-9 rounded-lg font-semibold text-[13px] ' + (on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'); });
    const ad = document.querySelector('[data-when-alldays]'); if (ad) ad.classList.toggle('invisible', all);
  }
  const ad = document.querySelector('[data-when-alldays]'); if (ad) ad.onclick = () => { w.days = []; paintDays(); };
  document.querySelectorAll('.wday-btn').forEach(b => b.onclick = () => {
    const i = +b.dataset.whenDay;
    const cur = w.days.length ? w.days.slice() : [0, 1, 2, 3, 4, 5, 6];
    const k = cur.indexOf(i);
    if (k >= 0) { if (cur.length === 1) return; cur.splice(k, 1); } else cur.push(i);
    w.days = cur.length === 7 ? [] : cur;
    paintDays();
  });
  paintDays();
}

export function syncWhen() {
  const w = window.__when;
  if (w.type === 'fixos') { const t = $('ed-tolerance'); if (t) w.toleranceMin = Math.max(0, parseInt(t.value, 10) || 0); }
  else if (w.type === 'intervalo') { const e = $('ed-every'), u = $('ed-unit'); if (e) w.every = Math.max(1, parseInt(e.value) || 1); if (u) w.unit = u.value; }
  else if (w.type === 'vezes') { const c = $('ed-count'), pd = $('ed-period'); if (c) w.count = Math.max(1, parseInt(c.value) || 1); if (pd) w.period = pd.value; }
  const st = $('ed-start'), en = $('ed-end'), tol = $('ed-tolerance');
  if (st && st.value) w.start = st.value;
  if (en && en.value) w.end = en.value;
  if (tol) w.toleranceMin = Math.max(0, parseInt(tol.value, 10) || 0);
}

// janela do dia (início/fim) pra "a cada X horas" e "N vezes ao dia": é o que transforma
// a frequência em horários concretos, cada um com seu próprio registro.
function windowBlock(w) {
  const inp = (id, v) => `<input id="${id}" type="time" step="300" value="${esc(v)}" class="bg-surface-container-low rounded-lg px-3 py-2 mono text-[15px] text-on-surface border border-transparent focus:border-primary">`;
  const act = activeTurnos(unitTurnos()), exp = expediente(unitTurnos());
  const chipCls = on => `tap flex-1 flex flex-col items-center py-2 rounded-lg text-[12px] font-semibold ${on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`;
  // em quais turnos (ou, com a unidade num turno só, o expediente) — ou um horário próprio
  const turnoChips = act.length > 1
    ? act.map(t => `<button data-win-turno="${t.idx}" class="${chipCls(w.useExp && w.winTurnos.has(t.idx))}">${t.idx + 1}º turno<span class="mono text-[10px] font-normal opacity-80">${t.inicio}–${t.fim}</span></button>`).join('')
    : `<button data-win-turno="${act[0].idx}" class="${chipCls(w.useExp)}">Expediente<span class="mono text-[10px] font-normal opacity-80">${exp.start}–${exp.end}</span></button>`;
  return `<div class="flex gap-2 mt-3">${turnoChips}<button data-win-custom class="${chipCls(!w.useExp)}">Personalizado<span class="mono text-[10px] font-normal opacity-80">${w.useExp ? 'outro horário' : `${esc(w.start)}–${esc(w.end)}`}</span></button></div>
    ${w.useExp ? '' : `<div class="flex items-center gap-2 mt-3 flex-wrap">
      <span class="text-[13px] text-on-surface">Das</span>${inp('ed-start', w.start)}
      <span class="text-[13px] text-on-surface">às</span>${inp('ed-end', w.end)}
    </div>`}`;
}

// sem start/end = segue o expediente da unidade (muda junto se os turnos mudarem)
function whenSchedule(w) {
  const win = w.useExp ? { turnos: [...w.winTurnos].sort() } : { start: w.start, end: w.end };
  if (w.type === 'intervalo') return { type: 'intervalo', every: w.every, unit: w.unit, ...win };
  if (w.type === 'vezes') return { type: 'vezes', count: w.count, period: w.period, ...win };
  if (w.type === 'momentos') return { type: 'momentos', moments: [...w.moments], turnos: [...w.turnos].sort() };
  return null;
}

function paintSlotPreview() {
  const el = $('ed-slot-preview'); if (!el) return;
  const cnt = $('ed-slot-count');
  const w = window.__when;
  if (w.type !== 'momentos' && !w.useExp && !(toMin(w.end) > toMin(w.start))) {
    el.innerHTML = `<span class="text-[12px] text-error font-semibold">O fim precisa ser depois do início.</span>`; if (cnt) cnt.textContent = ''; return;
  }
  const sch = whenSchedule(w);
  const slots = daySlots(sch, [], '', unitTurnos());
  const labels = w.type === 'momentos' ? slotLabels(sch, [], '', unitTurnos()) : {};
  const chip = t => `<span class="inline-flex items-center gap-1 bg-surface-container-low rounded-md px-2 py-1 text-[12px] text-on-surface">${labels[t] ? `<span>${esc(labels[t])}</span>·` : ''}<span class="mono font-semibold">${t}</span></span>`;
  el.innerHTML = slots.map(chip).join('');
  if (cnt) cnt.textContent = slots.length ? `${slots.length} por dia` : '';
}

// horários fixos: cada um é um chip grande ("08:00 ×"); adicionar/editar abre uma folha
// com grade de horas e de minutos — um toque em cada, fácil de acertar no celular
// (antes eram dois <select> minúsculos lado a lado).
export function renderEditorTimes() {
  const wrap = $('ed-times'); if (!wrap) return;
  window.__editorTimes = [...new Set(window.__editorTimes.filter(Boolean))].sort();
  const addChip = `<button data-action="add-time" class="tap inline-flex items-center gap-1.5 bg-surface-container-low rounded-lg px-3.5 h-11 border border-dashed border-outline-variant text-primary font-semibold text-[14px]">${icon('add', 'text-[20px]')} Adicionar horário</button>`;
  wrap.innerHTML = window.__editorTimes.map((t, i) => `<span class="inline-flex items-center bg-surface-container-low rounded-lg h-11 overflow-hidden">
      <button data-action="edit-time" data-idx="${i}" class="tap h-full flex items-center gap-1.5 pl-3 pr-1.5">${icon('schedule', 'text-on-surface-variant text-[18px]')}<span class="mono text-[16px] font-semibold text-on-surface">${esc(t)}</span></button>
      <button data-action="del-time" data-idx="${i}" aria-label="Remover ${esc(t)}" class="tap h-full w-10 flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
    </span>`).join('') + addChip;
}

// idx = -1 adiciona; senão edita o horário daquela posição
export function openTimePicker(idx = -1) {
  const cur = idx >= 0 ? window.__editorTimes[idx] : '';
  const pick = { h: cur ? +cur.slice(0, 2) : null, m: cur ? +cur.slice(3, 5) : 0 };
  const btnCls = on => `tap h-11 rounded-lg mono text-[15px] font-semibold ${on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface'}`;
  const paint = () => {
    const val = pick.h === null ? null : String(pick.h).padStart(2, '0') + ':' + String(pick.m).padStart(2, '0');
    const dup = val && window.__editorTimes.some((t, i) => t === val && i !== idx);
    $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-end sm:items-center justify-center" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[420px] max-h-[90dvh] overflow-y-auto scroll-area shadow-2xl p-4" style="padding-bottom:max(16px, env(safe-area-inset-bottom))">
      <div class="flex items-center justify-between pb-3 border-b border-outline-variant/40">
        <div class="font-semibold text-on-surface text-[16px]">${idx >= 0 ? 'Alterar horário' : 'Adicionar horário'}</div>
        <div class="mono text-[22px] font-bold ${val ? 'text-primary' : 'text-outline-variant'}">${val || '--:--'}</div>
      </div>
      <p class="mono text-[10px] uppercase tracking-wide text-on-surface-variant mt-3 mb-2">Hora</p>
      <div class="grid grid-cols-6 gap-1.5">${Array.from({ length: 24 }, (_, h) => `<button data-pick-h="${h}" class="${btnCls(pick.h === h)}">${String(h).padStart(2, '0')}</button>`).join('')}</div>
      <p class="mono text-[10px] uppercase tracking-wide text-on-surface-variant mt-4 mb-2">Minuto</p>
      <div class="grid grid-cols-6 gap-1.5">${Array.from({ length: 12 }, (_, k) => k * 5).map(m => `<button data-pick-m="${m}" class="${btnCls(pick.m === m)}">${String(m).padStart(2, '0')}</button>`).join('')}</div>
      ${dup ? `<p class="text-[12px] text-error font-semibold mt-3">${val} já está na lista.</p>` : ''}
      <div class="flex gap-2 mt-4">
        <button data-action="close-x" class="tap flex-1 bg-surface-container text-on-surface rounded-xl py-3.5 font-semibold text-[14px]">Cancelar</button>
        <button data-time-ok ${!val || dup ? 'disabled' : ''} class="tap flex-1 rounded-xl py-3.5 font-semibold text-[14px] ${!val || dup ? 'bg-surface-container text-outline-variant' : 'bg-primary text-on-primary'}">${val ? (idx >= 0 ? `Salvar ${val}` : `Adicionar ${val}`) : 'Escolha a hora'}</button>
      </div>
    </div></div>`;
    document.querySelectorAll('[data-pick-h]').forEach(b => b.onclick = () => { pick.h = +b.dataset.pickH; pick.m = 0; paint(); }); // hora nova começa em :00
    document.querySelectorAll('[data-pick-m]').forEach(b => b.onclick = () => { pick.m = +b.dataset.pickM; paint(); });
    const ok = document.querySelector('[data-time-ok]');
    if (ok) ok.onclick = () => {
      if (!val || dup) return;
      if (idx >= 0) window.__editorTimes[idx] = val; else window.__editorTimes.push(val);
      closeModal(); renderEditorTimes();
    };
  };
  paint();
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
      </div>`;

  if (p.type === 'texto') return `
      <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-3">
        <div class="mono text-[10px] text-on-surface-variant">Resposta do operador</div>
        <div class="h-8 border-b border-dashed border-outline-variant mt-1"></div>
      </div>`;

  if (p.type === 'simnao') return `
      <div class="grid grid-cols-2 gap-2">
        <div class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface font-semibold text-[13px]">${icon('check', 'text-[16px]')} Sim</div>
        <div class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface font-semibold text-[13px]">${icon('close', 'text-[16px]')} Não</div>
      </div>`;

  if (p.type === 'data') return `
      <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-3 flex items-center gap-2">
        ${icon('calendar_today', 'text-on-surface-variant text-[16px]')}<span class="mono text-[12px] text-on-surface-variant">dd/mm/aaaa</span>
      </div>`;

  if (p.type === 'hora') return `
      <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-3 flex items-center gap-2">
        ${icon('schedule', 'text-on-surface-variant text-[16px]')}<span class="mono text-[12px] text-on-surface-variant">hh:mm</span>
      </div>`;

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
      <button type="button" data-opt-add class="tap inline-flex items-center gap-1 text-primary font-semibold text-[13px]">${icon('add', 'text-[18px]')} Adicionar opção</button>`;
  }

  // qualitative (Conformidade)
  return `
      <div class="grid grid-cols-2 gap-2">
        <div class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-conf-bg text-conf-tx font-semibold text-[13px]">${icon('check_circle', 'text-[16px]', true)}<span data-preview-good>${esc(p.good || 'Conforme')}</span></div>
        <div class="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-nc-bg text-nc-tx font-semibold text-[13px]">${icon('cancel', 'text-[16px]', true)} Não Conf.</div>
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
      p.good = p.good || 'Conforme'; // texto do "conforme" não é mais editável; mantém o que já existia
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
  const payload = { pacId: pac.id, title, due, schedule, days, times, location: loc, params: window.__editorParams, toleranceMin, fillMode: window.__fillMode };

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
