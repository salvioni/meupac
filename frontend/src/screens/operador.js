import { $, esc, icon, fmtTime, fmtDT, toast, hashFor } from '../helpers.js';
import { DB, currentUser, params, getForm, getPac, visibleToOperator, pacActive, formActive, todaySubFor, dueText, plCode, formSlots, slotStates, openSlots } from '../state.js';
import { toMin, usesWindow } from '../schedule.js';
import { shell, profileTrigger, pcard } from '../ui.js';
import { OP_NAV, GE_NAV, STATUS_META } from '../config.js';
import * as api from '../api.js';
import { navigate } from '../router.js';
import { exportRecordPdf as pdfExportRecord } from '../pdf.js';

const app = () => $('app');
let opFilter = 'afazer';
export function setOpFilter(v) { opFilter = v; }

export function renderOpPac() {
  const uid = currentUser.id;
  const myForms = DB.forms.filter(f => visibleToOperator(f, uid) && formActive(f) && pacActive(getPac(f.pacId)));

  // a lista é de tarefas, não de planilhas: uma planilha com vários horários no dia
  // (ex.: a cada 2h) aparece uma vez por horário atrasado + o próximo a vencer.
  const todo = [], done = [];
  myForms.forEach(f => {
    if (formSlots(f).length) {
      openSlots(f).forEach(x => todo.push({ f, slot: x.slot, st: x.status, min: toMin(x.slot) }));
      slotStates(f).filter(x => x.sub).forEach(x => done.push({ f, slot: x.slot, sub: x.sub }));
    } else {
      const sub = todaySubFor(f.id);
      if (sub) done.push({ f, slot: null, sub }); else todo.push({ f, slot: null, st: 'afazer', min: Infinity });
    }
  });
  todo.sort((a, b) => (a.st === 'atrasado' ? 0 : 1) - (b.st === 'atrasado' ? 0 : 1) || a.min - b.min);
  done.sort((a, b) => new Date(b.sub.ts) - new Date(a.sub.ts));

  const freq = f => dueText(f).split(' · ')[0];
  const row = t => {
    const { f } = t; const pac = getPac(f.pacId);
    if (t.sub) return pcard({
      icon: pac.icon, occ: !!t.sub.occurrence, title: f.title,
      meta: `<span class="truncate">${t.slot ? `Horário ${t.slot} · ` : ''}Enviado às ${fmtTime(t.sub.ts)}</span>`,
      trailing: icon('chevron_right', 'text-on-surface-variant flex-none'),
      open: `data-action="open-sub" data-sub="${t.sub.id}"`,
    });
    return pcard({
      icon: pac.icon, occ: false, title: f.title,
      meta: `${icon('schedule', 'text-[14px] flex-none')}<span class="truncate">${!t.slot ? esc(dueText(f)) : usesWindow(f.schedule) ? `${t.slot} · ${esc(freq(f))}` : `às ${t.slot}`}</span>`,
      trailing: t.st === 'atrasado'
        ? `<span class="mono text-[10px] font-bold uppercase px-2 py-1 rounded ${STATUS_META.atrasado.bg} ${STATUS_META.atrasado.tx} flex-none">${STATUS_META.atrasado.label}</span>`
        : `<span class="mono text-[10px] font-semibold uppercase px-2 py-1 rounded bg-surface-container text-on-surface-variant flex-none">No Prazo</span>`,
      open: `data-action="open-form" data-form="${f.id}"${t.slot ? ` data-slot="${t.slot}"` : ''}`,
    });
  };

  const all = [...todo, ...done];
  const empty = (ic, t, s) => `<div class="flex flex-col items-center py-14 text-center">${icon(ic, 'text-secondary text-[44px]', true)}<p class="font-semibold text-on-surface mt-2">${t}</p><p class="text-[12px] text-on-surface-variant">${s}</p></div>`;
  const tab = (k, label, n) => { const on = opFilter === k; return `<button data-action="op-filter" data-filter="${k}" class="tap flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest border border-outline-variant/60 text-on-surface-variant'}">${label}<span class="mono text-[10px] font-bold px-1.5 rounded-full ${on ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'}">${n}</span></button>`; };

  const list = opFilter === 'afazer' ? todo : opFilter === 'concluidas' ? done : all;
  const body = !list.length
    ? (opFilter === 'afazer' ? empty('task_alt', 'Tudo em dia!', 'Nenhuma planilha pendente no momento.') : empty('inbox', 'Nada por aqui', 'Nenhum registro nesta lista ainda.'))
    : `<div class="space-y-2">${list.map(row).join('')}</div>`;

  const inner = `<div class="px-4 py-5 space-y-4">
    <div>
      <h1 class="text-[26px] font-bold text-on-surface leading-tight">A Preencher Hoje</h1>
      <p class="text-[13px] text-on-surface-variant">São as planilhas do seu turno para preencher hoje.</p>
    </div>
    <div class="flex gap-2">${tab('afazer', 'A Fazer', todo.length)}${tab('concluidas', 'Concluídas', done.length)}${tab('todas', 'Todas', all.length)}</div>
    ${body}
  </div>`;
  app().innerHTML = shell(inner, OP_NAV, 'op_pac', profileTrigger());
}

export function renderPreencher() {
  const f = getForm(params.form);
  if (!f) { navigate('op_pac'); return; }
  const pac = getPac(f.pacId);
  const hasSlots = formSlots(f).length > 0;
  const existing = hasSlots
    ? ((slotStates(f).find(x => x.slot === params.slot) || {}).sub)
    : todaySubFor(f.id);
  if (existing) { navigate('op_detalhe', { sub: existing.id }); return; }
  // sem horário na URL (link antigo/F5), assume o primeiro em aberto
  if (hasSlots && !formSlots(f).includes(params.slot)) {
    const open = openSlots(f);
    if (!open.length) { navigate('op_pac'); return; }
    params.slot = open[0].slot;
  }
  window.__fillSlot = hasSlots ? params.slot : null;

  window.__fill = {};
  f.params.forEach(p => { window.__fill[p.id] = null; });

  const paramHtml = f.params.map(p => {
    const optTag = p.required === false ? ' <span class="text-[10px] font-normal text-on-surface-variant">(opcional)</span>' : '';
    if (p.type === 'numeric') {
      return `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4" data-param="${p.id}" data-type="numeric" data-min="${p.min}" data-max="${p.max}" data-step="${p.step}">
        <div class="flex items-center justify-between">
          <div><div class="font-semibold text-on-surface">${esc(p.name)}${optTag}</div>
          <div class="mono text-[11px] text-on-surface-variant">Faixa: ${p.min.toFixed(1)} a ${p.max.toFixed(1)} ${p.unit}</div></div>
          <span class="param-status mono text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">— sem medição</span>
        </div>
        <div class="flex items-center gap-3 mt-3">
          <button data-step-btn="-" class="tap w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center">${icon('remove', 'text-primary')}</button>
          <div class="flex-1 flex items-baseline justify-center gap-1 bg-surface-container-low rounded-lg py-2">
            <input type="number" inputmode="decimal" placeholder="—" class="num-input param-val mono text-[28px] font-bold text-on-surface bg-transparent w-24 text-center placeholder:text-outline-variant" value="">
            <span class="mono text-[13px] text-on-surface-variant">${p.unit}</span>
          </div>
          <button data-step-btn="+" class="tap w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center">${icon('add', 'text-primary')}</button>
        </div>
      </div>`;
    }
    if (p.type === 'numero') {
      return `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4" data-param="${p.id}" data-type="numero" data-step="${p.step}">
        <div class="font-semibold text-on-surface mb-2">${esc(p.name)}${optTag}</div>
        <div class="flex items-center gap-3">
          <button data-step-btn="-" class="tap w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center">${icon('remove', 'text-primary')}</button>
          <div class="flex-1 flex items-baseline justify-center gap-1 bg-surface-container-low rounded-lg py-2">
            <input type="number" inputmode="decimal" placeholder="—" class="num-input param-val mono text-[28px] font-bold text-on-surface bg-transparent w-24 text-center placeholder:text-outline-variant" value="">
            ${p.unit ? `<span class="mono text-[13px] text-on-surface-variant">${esc(p.unit)}</span>` : ''}
          </div>
          <button data-step-btn="+" class="tap w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center">${icon('add', 'text-primary')}</button>
        </div>
      </div>`;
    }
    if (p.type === 'texto') {
      return `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4" data-param="${p.id}" data-type="texto">
        <div class="font-semibold text-on-surface mb-2">${esc(p.name)}${optTag}</div>
        <textarea class="texto-val w-full bg-surface-container-low rounded-lg p-3 text-[13px] border border-transparent focus:border-primary resize-none" rows="2" placeholder="Escreva aqui..."></textarea>
      </div>`;
    }
    if (p.type === 'simnao') {
      return `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4" data-param="${p.id}" data-type="simnao">
        <div class="font-semibold text-on-surface mb-3">${esc(p.name)}${optTag}</div>
        <div class="grid grid-cols-2 gap-2">
          <button data-simnao="sim" class="simnao-btn tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold text-[13px]">${icon('check', 'text-[18px]')} Sim</button>
          <button data-simnao="nao" class="simnao-btn tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold text-[13px]">${icon('close', 'text-[18px]')} Não</button>
        </div>
      </div>`;
    }
    if (p.type === 'data') {
      return `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4" data-param="${p.id}" data-type="data">
        <div class="font-semibold text-on-surface mb-2">${esc(p.name)}${optTag}</div>
        <input type="date" class="data-val w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] text-on-surface border border-transparent focus:border-primary">
      </div>`;
    }
    if (p.type === 'hora') {
      return `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4" data-param="${p.id}" data-type="hora">
        <div class="font-semibold text-on-surface mb-2">${esc(p.name)}${optTag}</div>
        <input type="time" class="hora-val w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] text-on-surface border border-transparent focus:border-primary">
      </div>`;
    }
    if (p.type === 'escolha') {
      const options = p.options || [];
      return `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4" data-param="${p.id}" data-type="escolha">
        <div class="font-semibold text-on-surface mb-3">${esc(p.name)}${optTag}</div>
        <div class="flex flex-wrap gap-2">
          ${options.map(op => `<button data-escolha="${esc(op)}" class="escolha-btn tap flex-1 min-w-[45%] py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold text-[13px]">${esc(op)}</button>`).join('')}
        </div>
      </div>`;
    }
    return `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4" data-param="${p.id}" data-type="qualitative" data-good="${esc(p.good)}">
      <div class="font-semibold text-on-surface">${esc(p.name)}${optTag}</div>
      <div class="mono text-[11px] text-on-surface-variant mb-3">Esperado: ${esc(p.good)}</div>
      <div class="grid grid-cols-2 gap-2">
        <button data-qual="ok" class="qual-btn tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold text-[13px]">${icon('check_circle', 'text-[18px]')} Conforme</button>
        <button data-qual="no" class="qual-btn tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold text-[13px]">${icon('cancel', 'text-[18px]')} Não Conf.</button>
      </div>
    </div>`;
  }).join('');

  const inner = `<div class="px-4 py-4 space-y-4 pb-6">
    <button data-action="nav" data-nav="op_pac" class="tap inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">${icon('arrow_back', 'text-[18px]')} Voltar aos registros</button>
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="mono text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-conf-bg text-conf-tx">${esc(pac.name)}</span>
        <span class="mono text-[10px] text-on-surface-variant">${plCode(f)}</span>
      </div>
      <h1 class="text-[24px] font-bold text-on-surface leading-tight">${esc(f.title)}</h1>
      ${window.__fillSlot ? `<div class="flex items-center gap-1.5 mt-1 text-[12px] text-on-surface-variant">${icon('schedule', 'text-[15px]')} Registro das ${window.__fillSlot}</div>` : ''}
    </div>
    <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 flex gap-3">
      ${icon('location_on', 'text-secondary flex-none', true)}
      <div><div class="mono text-[10px] uppercase tracking-wide text-on-surface-variant">Local de Coleta · ${esc(f.sector)}</div>
      <div class="font-semibold text-on-surface text-[14px]">${esc(f.location)}</div></div>
    </div>
    <p class="mono text-[10px] uppercase tracking-widest text-on-surface-variant pt-1">Parâmetros de Qualidade</p>
    ${paramHtml}
    <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4">
      <div class="flex items-center gap-2 mb-3">${icon('photo_camera', 'text-secondary', true)}<span class="font-semibold text-on-surface text-[14px]">Registro Visual e Notas</span><span class="text-[11px] text-on-surface-variant">· opcional</span></div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <button data-action="mock-photo" class="tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold text-[13px]">${icon('add_a_photo', 'text-[18px]')} Anexar Foto</button>
        <button data-action="focus-note" class="tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold text-[13px]">${icon('note_add', 'text-[18px]')} Inserir Nota</button>
      </div>
      <span id="photo-tag" class="hidden mono text-[11px] text-secondary items-center gap-1">${icon('check', 'text-[14px]')} Foto anexada · fita_colorimetrica.jpg</span>
      <textarea id="fill-note" rows="2" placeholder="Observações da coleta..." class="w-full mt-1 text-[13px] bg-surface-container-low rounded-lg p-3 border border-transparent focus:border-primary resize-none"></textarea>
    </div>
    <button data-action="submit-fill" class="tap w-full bg-primary text-on-primary rounded-xl py-4 font-semibold flex items-center justify-center gap-2 text-[15px]">${icon('task_alt', ' ', true)} Registrar e Assinar Medição</button>
    <p class="text-center text-[11px] text-on-surface-variant">Ao registrar, ${esc(currentUser.name)} assina digitalmente este documento.</p>
  </div>`;
  app().innerHTML = shell(inner, OP_NAV, 'op_pac', profileTrigger());
  bindFillEvents(f);
}

function bindFillEvents(f) {
  document.querySelectorAll('[data-param][data-type="numeric"]').forEach(box => {
    const pid = box.dataset.param, min = +box.dataset.min, max = +box.dataset.max, step = +box.dataset.step;
    const input = box.querySelector('.param-val'), st = box.querySelector('.param-status');
    function refresh() {
      const raw = input.value.trim();
      if (raw === '') {
        window.__fill[pid] = null;
        st.textContent = '— sem medição';
        st.className = 'param-status mono text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant';
        input.className = 'num-input param-val mono text-[28px] font-bold bg-transparent w-24 text-center text-on-surface placeholder:text-outline-variant';
        return;
      }
      let v = parseFloat(raw); if (isNaN(v)) v = 0;
      window.__fill[pid] = v;
      const ok = v >= min && v <= max;
      st.textContent = ok ? '✓ Dentro da faixa' : '▲ Fora da faixa';
      st.className = 'param-status mono text-[10px] font-semibold uppercase tracking-wide ' + (ok ? 'text-secondary' : 'text-error');
      input.className = 'num-input param-val mono text-[28px] font-bold bg-transparent w-24 text-center ' + (ok ? 'text-on-surface' : 'text-error');
    }
    box.querySelector('[data-step-btn="+"]').onclick = () => { input.value = (input.value.trim() === '' ? min : (parseFloat(input.value) + step)).toFixed(1); refresh(); };
    box.querySelector('[data-step-btn="-"]').onclick = () => { input.value = (input.value.trim() === '' ? min : (parseFloat(input.value) - step)).toFixed(1); refresh(); };
    input.oninput = refresh; refresh();
  });
  document.querySelectorAll('[data-param][data-type="numero"]').forEach(box => {
    const pid = box.dataset.param, step = +box.dataset.step || 1;
    const input = box.querySelector('.param-val');
    function refresh() {
      const raw = input.value.trim();
      window.__fill[pid] = raw === '' ? null : (parseFloat(raw) || 0);
    }
    // casas decimais seguem o incremento (1 → inteiro, 0.5 → 1 casa, 0.01 → 2 casas)
    const decsOf = (x) => (String(x).split('.')[1] || '').length;
    const bump = (d) => { const cur = parseFloat(input.value); input.value = (Number.isNaN(cur) ? 0 : cur + d).toFixed(Math.max(decsOf(step), decsOf(input.value))); refresh(); };
    box.querySelector('[data-step-btn="+"]').onclick = () => bump(step);
    box.querySelector('[data-step-btn="-"]').onclick = () => bump(-step);
    input.oninput = refresh; refresh();
  });
  document.querySelectorAll('[data-param][data-type="qualitative"]').forEach(box => {
    const pid = box.dataset.param, good = box.dataset.good;
    const btnOk = box.querySelector('[data-qual="ok"]'), btnNo = box.querySelector('[data-qual="no"]');
    function setOk(ok) {
      window.__fill[pid] = ok;
      btnOk.className = 'qual-btn tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-semibold text-[13px] ' + (ok ? 'bg-conf-bg text-conf-tx ring-1 ring-conf-bd' : 'bg-surface-container text-on-surface-variant');
      btnNo.className = 'qual-btn tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-semibold text-[13px] ' + (!ok ? 'bg-nc-bg text-nc-tx ring-1 ring-nc-bd' : 'bg-surface-container text-on-surface-variant');
    }
    btnOk.onclick = () => setOk(true); btnNo.onclick = () => setOk(false);
  });
  document.querySelectorAll('[data-param][data-type="texto"]').forEach(box => {
    const pid = box.dataset.param, ta = box.querySelector('.texto-val');
    ta.oninput = () => { window.__fill[pid] = ta.value.trim() || null; };
  });
  document.querySelectorAll('[data-param][data-type="simnao"]').forEach(box => {
    const pid = box.dataset.param;
    const btns = box.querySelectorAll('.simnao-btn');
    btns.forEach(b => b.onclick = () => {
      window.__fill[pid] = b.dataset.simnao === 'sim';
      btns.forEach(x => x.className = 'simnao-btn tap flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-semibold text-[13px] ' + (x === b ? 'bg-secondary-container text-on-secondary-container ring-1 ring-secondary' : 'bg-surface-container text-on-surface-variant'));
    });
  });
  document.querySelectorAll('[data-param][data-type="data"]').forEach(box => {
    const pid = box.dataset.param, inp = box.querySelector('.data-val');
    inp.onchange = () => { window.__fill[pid] = inp.value || null; };
  });
  document.querySelectorAll('[data-param][data-type="hora"]').forEach(box => {
    const pid = box.dataset.param, inp = box.querySelector('.hora-val');
    inp.onchange = () => { window.__fill[pid] = inp.value || null; };
  });
  document.querySelectorAll('[data-param][data-type="escolha"]').forEach(box => {
    const pid = box.dataset.param;
    const btns = box.querySelectorAll('.escolha-btn');
    btns.forEach(b => b.onclick = () => {
      window.__fill[pid] = b.dataset.escolha;
      btns.forEach(x => x.className = 'escolha-btn tap flex-1 min-w-[45%] py-2.5 rounded-lg font-semibold text-[13px] ' + (x === b ? 'bg-secondary-container text-on-secondary-container ring-1 ring-secondary' : 'bg-surface-container text-on-surface-variant'));
    });
  });
}

export async function submitFill() {
  const f = getForm(params.form);
  const faltando = f.params.filter(p => { if (p.required === false) return false; const v = window.__fill[p.id]; return v === null || v === undefined; });
  if (faltando.length) { toast('Preencha: ' + faltando.map(p => p.name).join(', '), 'err'); return; }
  const note = ($('fill-note') && $('fill-note').value.trim()) || '';
  const btn = document.querySelector('[data-action="submit-fill"]');
  if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }
  try {
    await api.createSubmission(f.id, window.__fill, note, window.__fillSlot);
    await api.refreshState();
    toast('Registro enviado e assinado.');
    setOpFilter('afazer');
    navigate('op_pac');
  } catch (e) {
    toast(e.message || 'Não foi possível enviar o registro.', 'err');
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
  }
}

export function renderDetalhe() {
  const sub = DB.submissions.find(s => s.id === params.sub);
  if (!sub) { navigate('op_pac'); return; }
  const f = getForm(sub.formId); const pac = getPac(f.pacId);
  const back = currentUser.role === 'operador' ? (params.from === 'hist' ? 'op_hist' : 'op_pac') : 'ge_hist';
  const graded = { numeric: true, qualitative: true, escolha: true };
  const gradedParams = f.params.filter(p => graded[p.type]);
  const conformes = gradedParams.filter(p => sub.values[p.id] && sub.values[p.id].ok).length;
  const total = gradedParams.length;

  const paramIcon = { numeric: 'science', numero: 'tag', qualitative: 'visibility', texto: 'notes', simnao: 'help', data: 'calendar_today', hora: 'schedule', escolha: 'list' };
  const paramRows = f.params.map(p => {
    const v = sub.values[p.id] || { ok: false, val: '—' };
    const isGraded = !!graded[p.type];
    return `<div class="flex items-center gap-3 py-3 border-b border-outline-variant/30 last:border-0">
      <span class="w-9 h-9 rounded-lg ${isGraded ? (v.ok ? 'bg-conf-bg' : 'bg-nc-bg') : 'bg-surface-container'} flex items-center justify-center flex-none">${icon(paramIcon[p.type] || 'visibility', (isGraded ? (v.ok ? 'text-conf-tx' : 'text-nc-tx') : 'text-on-surface-variant') + ' text-[18px]', true)}</span>
      <div class="flex-1 min-w-0"><div class="font-medium text-on-surface text-[14px]">${esc(p.name)}</div>
      ${p.type === 'numeric' ? `<div class="mono text-[11px] text-on-surface-variant">Faixa ${p.min}–${p.max} ${p.unit}</div>` : ''}</div>
      <div class="text-right"><div class="mono font-bold text-on-surface ${isGraded && !v.ok ? 'text-error' : ''}">${esc(v.val)}</div></div>
      ${isGraded ? `<span class="w-7 h-7 rounded-full ${v.ok ? 'bg-conf-bd' : 'bg-nc-bd'} flex items-center justify-center flex-none">${icon(v.ok ? 'check' : 'priority_high', 'text-white text-[16px]', true)}</span>` : ''}
    </div>`;
  }).join('');

  const inner = `<div class="px-4 py-4 space-y-4 pb-8">
    <div class="flex items-center justify-between gap-2">
      <button data-action="nav" data-nav="${back}" class="tap inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">${icon('arrow_back', 'text-[18px]')} Voltar aos registros</button>
      <button data-action="export-pdf" data-sub="${sub.id}" class="tap flex items-center gap-1.5 bg-surface-container text-on-surface-variant rounded-lg px-3 py-2 text-[12px] font-semibold flex-none">${icon('picture_as_pdf', 'text-[16px]')} Baixar PDF</button>
    </div>
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="mono text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-conf-bg text-conf-tx">${esc(pac.name)}</span>
        <span class="mono text-[10px] text-on-surface-variant">${plCode(f)}</span>
      </div>
      <h1 class="text-[24px] font-bold text-on-surface leading-tight">${esc(f.title)}</h1>
      <div class="flex items-center gap-1.5 mt-1 text-[12px] text-on-surface-variant">${sub.slot ? `Registro das ${sub.slot} · ` : ''}Enviado em ${fmtDT(sub.ts)} · <span class="text-secondary font-semibold">${sub.signedBy ? 'Assinado' : 'Concluído'}</span></div>
    </div>
    <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4">
      <div class="flex items-center justify-between mb-1"><div class="flex items-center gap-1.5">${icon('location_on', 'text-secondary text-[18px]', true)}<span class="mono text-[10px] uppercase tracking-wide text-on-surface-variant">Local de Coleta</span></div><span class="mono text-[11px] text-on-surface-variant">${esc(f.sector)}</span></div>
      <div class="font-semibold text-on-surface">${esc(f.location)}</div>
    </div>
    <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4">
      <div class="flex items-center justify-between mb-1"><span class="mono text-[10px] uppercase tracking-widest text-on-surface-variant">Parâmetros de Qualidade</span>
      ${total ? `<span class="mono text-[10px] font-semibold px-2 py-0.5 rounded ${conformes === total ? 'bg-conf-bg text-conf-tx' : 'bg-nc-bg text-nc-tx'}">${conformes} de ${total} Conformes</span>` : ''}</div>
      ${paramRows}
    </div>
    ${sub.occurrence ? `<div class="bg-nc-bg border border-nc-bd/40 rounded-xl p-4">
      <div class="flex items-center gap-2 mb-2">${icon('warning', 'text-nc-tx', true)}<span class="mono text-[10px] uppercase tracking-widest text-nc-tx font-semibold">Não Conformidade Registrada</span></div>
      <ul class="text-[13px] text-nc-tx space-y-1 mono">${sub.occurrence.issues.map(i => `<li>• ${esc(i)}</li>`).join('')}</ul>
      ${sub.occurrence.note ? `<p class="text-[13px] text-on-surface mt-2">${esc(sub.occurrence.note)}</p>` : ''}
    </div>` : ''}
    ${sub.note && !sub.occurrence ? `<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4"><div class="mono text-[10px] uppercase tracking-wide text-on-surface-variant mb-1">Notas</div><p class="text-[13px] text-on-surface">${esc(sub.note)}</p></div>` : ''}
    <div class="bg-surface-container border border-outline-variant/50 rounded-lg p-4">
      <div class="flex items-center gap-2 mb-2">${icon('verified_user', 'text-on-surface-variant text-[18px]', true)}<span class="mono text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Rastreabilidade e Segurança</span></div>
      <p class="text-[13px] text-on-surface">Registrado por <b>${esc(sub.operatorName)}</b> (Operador) em ${fmtDT(sub.ts)}.</p>
      ${sub.signedBy ? `<p class="text-[13px] text-on-surface mt-1">Validado por <b>${esc(sub.signedBy)}</b> em ${fmtDT(sub.signedAt)}.</p>` : ''}
      <p class="mono text-[11px] text-on-surface-variant mt-2">Hash de autenticidade: <span class="text-on-surface font-semibold">${hashFor(sub)}</span></p>
    </div>
    ${currentUser.role === 'gerente' && !sub.signedBy ? `<button data-action="sign" data-sub="${sub.id}" class="tap w-full bg-primary text-on-primary rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 text-[14px]">${icon('draw', '', true)} Assinar</button>` : ''}
    <p class="text-center mono text-[10px] uppercase tracking-wide text-on-surface-variant flex items-center justify-center gap-1">${icon('lock', 'text-[14px]')} Registro finalizado · não permite edição</p>
  </div>`;
  const nav = currentUser.role === 'operador' ? OP_NAV : GE_NAV;
  const active = currentUser.role === 'operador' ? 'op_pac' : 'ge_hist';
  app().innerHTML = shell(inner, nav, active, profileTrigger());
}

export function exportRecordPdf(subId) { pdfExportRecord(subId, DB.submissions); }
