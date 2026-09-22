import { $, esc, icon, toast } from '../helpers.js';
import { params, getForm, getPac, DB, nextPlNum, revLabel } from '../state.js';
import { shell, profileTrigger } from '../ui.js';
import { GE_NAV } from '../config.js';
import * as api from '../api.js';
import { navigate } from '../router.js';

const app = () => $('app');

export function renderFormEditor() {
  const editing = params.form ? getForm(params.form) : null;
  const pac = editing ? getPac(editing.pacId) : getPac(params.pac || DB.pacs[0].id);
  window.__editorParams = editing ? JSON.parse(JSON.stringify(editing.params)) : [{ id: 'np' + Date.now(), type: 'numeric', name: '', unit: '', min: 0, max: 0, step: 0.1, seed: 0 }];
  window.__editorTimes = editing ? (editing.times && editing.times.length ? editing.times.slice() : (editing.due ? [editing.due] : [])) : [];
  window.__when = editing && editing.schedule
    ? { type: editing.schedule.type || 'fixos', every: editing.schedule.every || 2, unit: editing.schedule.unit || 'horas', count: editing.schedule.count || 2, period: editing.schedule.period || 'dia', moments: new Set(editing.schedule.moments || []), days: (editing.schedule.days || editing.days || []).slice() }
    : { type: 'fixos', every: 2, unit: 'horas', count: 2, period: 'dia', moments: new Set(), days: [] };

  const inner = `<div class="px-4 py-4 space-y-4 pb-8">
    <button data-action="nav" data-nav="ge_forms" class="tap inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">${icon('arrow_back', 'text-[18px]')} Voltar para PACs</button>
    <h1 class="text-[22px] font-bold text-on-surface leading-tight">${editing ? 'Configurar Planilha' : 'Nova Planilha'}</h1>

    <section class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 space-y-3">
      <div class="flex items-center gap-2">${icon('badge', 'text-secondary text-[18px]', true)}<h2 class="mono text-[11px] uppercase tracking-widest text-on-surface font-semibold">Identificação Normativa</h2></div>
      <div class="bg-surface-container-low rounded-lg p-3"><div class="mono text-[10px] uppercase text-on-surface-variant">PAC Vinculado</div><div class="font-semibold text-on-surface">${pac.code} · ${esc(pac.name)}</div><div class="mono text-[11px] text-secondary">${esc(pac.norm)}</div></div>
      <div><label class="mono text-[10px] uppercase text-on-surface-variant">Título do Documento</label>
      <input id="ed-title" value="${editing ? esc(editing.title) : ''}" placeholder="Ex: Controle Diário de Cloração" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
      <div class="flex items-center justify-between bg-surface-container-low rounded-lg px-3 py-2.5">
        <div><div class="mono text-[10px] uppercase text-on-surface-variant">Código da Planilha</div><div class="mono text-[13px] font-bold text-on-surface">PL ${String(editing ? editing.plNum : nextPlNum(pac.id)).padStart(2, '0')}</div></div>
        <div class="text-right"><div class="mono text-[10px] uppercase text-on-surface-variant">${editing ? 'Ao publicar' : 'Revisão'}</div><div class="mono text-[13px] font-bold ${editing ? 'text-tertiary' : 'text-secondary'}">${editing ? 'Rev. ' + String((editing.rev || 1) + 1).padStart(2, '0') : 'Rev. 01'}</div></div>
      </div>
      ${editing ? `<div class="flex items-center gap-1.5 text-[11px] text-on-surface-variant">${icon('history', 'text-[15px]')} Vigente: ${revLabel(editing)} · a versão anterior fica arquivada na auditoria.</div>` : ''}
    </section>

    <section class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 space-y-3">
      <div class="flex items-center gap-2">${icon('schedule', 'text-secondary text-[18px]', true)}<h2 class="mono text-[11px] uppercase tracking-widest text-on-surface font-semibold">Frequência & Coleta</h2></div>
      <div id="ed-when-wrap"></div>
      <div><label class="mono text-[10px] uppercase text-on-surface-variant">Local / Ponto de Coleta</label><input id="ed-loc" value="${editing ? esc(editing.location) : ''}" placeholder="Ex: Reservatório Central" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
    </section>

    <section class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 space-y-3">
      <div class="flex items-center gap-2">${icon('tune', 'text-secondary text-[18px]', true)}<h2 class="mono text-[11px] uppercase tracking-widest text-on-surface font-semibold">Parâmetros e Limites Críticos</h2></div>
      <div id="ed-params" class="space-y-3"></div>
      <button data-action="add-param" class="tap w-full flex items-center justify-center gap-1.5 bg-surface-container text-primary rounded-lg py-2.5 font-semibold text-[13px]">${icon('add_circle', 'text-[18px]', true)} Adicionar Parâmetro</button>
    </section>

    <button data-action="save-form" class="tap w-full bg-primary text-on-primary rounded-xl py-4 font-semibold flex items-center justify-center gap-2 text-[15px]">${editing ? 'Salvar e Publicar Rev. ' + String((editing.rev || 1) + 1).padStart(2, '0') : 'Criar Planilha'}</button>
    <p class="text-center text-[11px] text-on-surface-variant">${editing ? 'Publicar cria uma nova revisão; a anterior é arquivada para auditoria.' : 'O código PL é gerado automaticamente e sequencial ao publicar.'}</p>
  </div>`;
  app().innerHTML = shell(inner, GE_NAV, 'ge_forms', profileTrigger());
  renderEditorParams();
  renderWhen();
}

export function renderWhen() {
  const wrap = $('ed-when-wrap'); if (!wrap) return;
  const w = window.__when;
  const typeBtn = (v, label, ic) => `<button data-action="when-type" data-type="${v}" class="tap flex items-center justify-center gap-1 py-2 rounded-lg text-[12px] font-semibold ${w.type === v ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}">${icon(ic, 'text-[16px]')} ${label}</button>`;
  let body = '';
  if (w.type === 'fixos') {
    body = `<div id="ed-times" class="flex flex-wrap gap-2"></div>
      <button data-action="add-time" class="tap mt-2 inline-flex items-center gap-1 text-primary font-semibold text-[13px]">${icon('add', 'text-[18px]')} Adicionar horário</button>`;
  } else if (w.type === 'intervalo') {
    body = `<div class="flex items-center gap-2">
      <span class="text-[13px] text-on-surface">A cada</span>
      <input id="ed-every" type="number" min="1" value="${w.every}" class="w-16 bg-surface-container-low rounded-lg px-3 py-2 mono text-[15px] text-on-surface text-center border border-transparent focus:border-primary">
      <select id="ed-unit" class="bg-surface-container-low rounded-lg px-3 py-2 text-[13px] font-semibold text-on-surface border border-transparent focus:border-primary"><option value="horas" ${w.unit === 'horas' ? 'selected' : ''}>horas</option><option value="minutos" ${w.unit === 'minutos' ? 'selected' : ''}>minutos</option></select>
    </div>`;
  } else if (w.type === 'vezes') {
    body = `<div class="flex items-center gap-2 flex-wrap">
      <input id="ed-count" type="number" min="1" value="${w.count}" class="w-16 bg-surface-container-low rounded-lg px-3 py-2 mono text-[15px] text-on-surface text-center border border-transparent focus:border-primary">
      <span class="text-[13px] text-on-surface">vez(es) por</span>
      <select id="ed-period" class="bg-surface-container-low rounded-lg px-3 py-2 text-[13px] font-semibold text-on-surface border border-transparent focus:border-primary"><option value="dia" ${w.period === 'dia' ? 'selected' : ''}>dia</option><option value="semana" ${w.period === 'semana' ? 'selected' : ''}>semana</option><option value="mes" ${w.period === 'mes' ? 'selected' : ''}>mês</option></select>
    </div><p class="text-[11px] text-on-surface-variant mt-2">Quantidade sem horário fixo (ex.: 3 vezes ao dia).</p>`;
  } else if (w.type === 'momentos') {
    const mo = (v, label) => { const on = w.moments.has(v); return `<button data-action="when-moment" data-m="${v}" class="tap w-full flex items-center justify-between px-3 py-2.5 rounded-lg ${on ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-low text-on-surface'}"><span class="text-[13px] font-medium">${label}</span><span class="material-symbols-outlined ${on ? 'ms-fill text-secondary' : 'text-outline-variant'} text-[20px]">${on ? 'check_circle' : 'radio_button_unchecked'}</span></button>`; };
    body = `<div class="space-y-2">${mo('inicio', 'Início do expediente')}${mo('fim', 'Fim do expediente')}</div>`;
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
  if (w.type === 'fixos') renderEditorTimes();
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
  if (w.type === 'fixos') { syncEditorTimes(); }
  else if (w.type === 'intervalo') { const e = $('ed-every'), u = $('ed-unit'); if (e) w.every = Math.max(1, parseInt(e.value) || 1); if (u) w.unit = u.value; }
  else if (w.type === 'vezes') { const c = $('ed-count'), pd = $('ed-period'); if (c) w.count = Math.max(1, parseInt(c.value) || 1); if (pd) w.period = pd.value; }
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

export function renderEditorParams() {
  const wrap = $('ed-params'); if (!wrap) return;
  wrap.innerHTML = window.__editorParams.map((p, i) => `<div class="border border-outline-variant/60 rounded-lg p-3 space-y-2" data-pidx="${i}">
    <div class="flex items-center justify-between">
      <div class="flex gap-1.5">
        <button data-ptype="numeric" class="tap mono text-[10px] font-semibold px-2 py-1 rounded ${p.type === 'numeric' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}">Numérico</button>
        <button data-ptype="qualitative" class="tap mono text-[10px] font-semibold px-2 py-1 rounded ${p.type === 'qualitative' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}">Qualitativo</button>
      </div>
      ${window.__editorParams.length > 1 ? `<button data-del-param class="tap text-error">${icon('delete', 'text-[18px]')}</button>` : ''}
    </div>
    <input data-pname placeholder="Nome do parâmetro" value="${esc(p.name)}" class="w-full bg-surface-container-low rounded-lg px-3 py-2 text-[13px] border border-transparent focus:border-primary">
    ${p.type === 'numeric' ? `<div class="grid grid-cols-3 gap-2">
      <input data-pmin type="number" step="0.1" placeholder="Mín" value="${p.min || ''}" class="bg-surface-container-low rounded-lg px-2 py-2 mono text-[13px] border border-transparent focus:border-primary">
      <input data-pmax type="number" step="0.1" placeholder="Máx" value="${p.max || ''}" class="bg-surface-container-low rounded-lg px-2 py-2 mono text-[13px] border border-transparent focus:border-primary">
      <input data-punit placeholder="Un" value="${esc(p.unit)}" class="bg-surface-container-low rounded-lg px-2 py-2 mono text-[13px] border border-transparent focus:border-primary">
    </div>` : `<input data-pgood placeholder="Resposta esperada (ex: Conforme)" value="${esc(p.good || 'Conforme')}" class="w-full bg-surface-container-low rounded-lg px-3 py-2 text-[13px] border border-transparent focus:border-primary">`}
  </div>`).join('');
  wrap.querySelectorAll('[data-pidx]').forEach(box => {
    const i = +box.dataset.pidx;
    box.querySelectorAll('[data-ptype]').forEach(b => b.onclick = () => { syncEditorParams(); window.__editorParams[i].type = b.dataset.ptype; renderEditorParams(); });
    const del = box.querySelector('[data-del-param]'); if (del) del.onclick = () => { syncEditorParams(); window.__editorParams.splice(i, 1); renderEditorParams(); };
  });
}

export function syncEditorParams() {
  document.querySelectorAll('#ed-params [data-pidx]').forEach(box => {
    const i = +box.dataset.pidx, p = window.__editorParams[i];
    p.name = box.querySelector('[data-pname]').value;
    if (p.type === 'numeric') { p.min = parseFloat(box.querySelector('[data-pmin]').value) || 0; p.max = parseFloat(box.querySelector('[data-pmax]').value) || 0; p.unit = box.querySelector('[data-punit]').value; p.step = 0.1; p.seed = p.min; }
    else { p.good = box.querySelector('[data-pgood]').value || 'Conforme'; }
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
  if (w.type === 'fixos') { times = window.__editorTimes.filter(Boolean).sort(); if (!times.length) { toast('Adicione ao menos um horário.', 'err'); return; } due = times[0] || ''; schedule = { type: 'fixos', times, days }; }
  else if (w.type === 'intervalo') { schedule = { type: 'intervalo', every: w.every, unit: w.unit, days }; }
  else if (w.type === 'vezes') { schedule = { type: 'vezes', count: w.count, period: w.period, days }; }
  else if (w.type === 'momentos') { const moments = [...w.moments]; if (!moments.length) { toast('Selecione ao menos um momento.', 'err'); return; } schedule = { type: 'momentos', moments, days }; }
  else { schedule = { type: 'demanda' }; }

  const editing = params.form ? getForm(params.form) : null;
  const loc = $('ed-loc').value.trim() || 'A definir';
  const pac = editing ? getPac(editing.pacId) : getPac(params.pac || DB.pacs[0].id);
  const payload = { pacId: pac.id, title, due, schedule, days, times, location: loc, params: window.__editorParams };

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
