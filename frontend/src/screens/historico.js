import { $, esc, icon, fmtTime, isToday, todayKey, isoAt, toast } from '../helpers.js';
import { DB, currentUser, getForm, getPac } from '../state.js';
import { shell, profileTrigger, pcard } from '../ui.js';
import { OP_NAV, GE_NAV } from '../config.js';
import { exportReportPdf, exportHistCsv } from '../pdf.js';

const app = () => $('app');
const filtActiveCls = () => 'bg-primary text-on-primary';
const filtInactiveCls = (k) => 'bg-surface-container-lowest border text-on-surface-variant ' + (k === 'ocorrencia' ? 'border-nc-bd/60' : k === 'assinar' ? 'border-outline' : 'border-outline-variant/60');

export function renderOpHist() {
  const mine = DB.submissions.filter(s => s.operatorId === currentUser.id).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  app().innerHTML = shell(histBody(mine, 'Meu Histórico', 'Planilhas preenchidas e enviadas por você.', false), OP_NAV, 'op_hist', profileTrigger());
  bindHist(mine, false);
}
export function renderGeHist() {
  const all = DB.submissions.slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
  app().innerHTML = shell(histBody(all, 'Histórico de Registros', 'Tudo que a equipe preencheu e assinou, com trilha de auditoria.', true), GE_NAV, 'ge_hist', profileTrigger());
  bindHist(all, true);
}

function histBody(subs, title, sub, showOperators) {
  const operators = showOperators ? [...new Set(subs.map(s => s.operatorName))] : [];
  return `<div class="px-4 py-5 space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div><h1 class="text-[26px] font-bold text-on-surface leading-tight">${esc(title)}</h1><p class="text-[13px] text-on-surface-variant">${esc(sub)}</p></div>
      ${showOperators ? `<button data-action="open-export" class="tap flex-none flex items-center gap-1.5 bg-primary text-on-primary rounded-lg px-3 py-2 text-[12px] font-semibold mt-1">${icon('download', 'text-[16px]')} Baixar</button>` : ''}
    </div>
    <div class="relative"><span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
      <input id="hist-search" placeholder="${showOperators ? 'Buscar formulário, PAC ou operador...' : 'Buscar formulário, PAC...'}" class="w-full bg-surface-container-lowest border border-outline-variant/60 rounded-lg pl-10 pr-3 py-2.5 text-[13px]"></div>
    <div class="flex gap-2 overflow-x-auto scroll-area -mx-4 px-4">
      ${[['todos', 'Todos'], ['hoje', 'Hoje'], ['ocorrencia', 'Não Conforme'], ...(showOperators ? [['assinar', 'A assinar']] : [])].map((f, i) => `<button data-filt="${f[0]}" class="filt-btn tap whitespace-nowrap text-[13px] font-semibold px-3.5 py-1.5 rounded-full ${i === 0 ? filtActiveCls() : filtInactiveCls(f[0])}">${f[1]}</button>`).join('')}
    </div>
    ${showOperators ? `<div class="flex gap-2">
      <div class="relative flex-1 min-w-0" data-dd="op">
        <button type="button" class="dd-trigger w-full flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/60 rounded-lg pl-3 pr-2 py-2.5 text-[12px] font-semibold text-on-surface">
          <span class="material-symbols-outlined text-on-surface-variant text-[18px] flex-none">person</span>
          <span class="dd-label flex-1 min-w-0 truncate text-left">Todos os operadores</span>
          <span class="material-symbols-outlined text-on-surface-variant text-[20px] flex-none">expand_more</span>
        </button>
        <div class="dd-panel hidden absolute z-40 left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-2xl max-h-64 overflow-y-auto scroll-area py-1">
          <button data-val="Todos" class="dd-opt w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-on-surface"><span class="truncate">Todos os operadores</span><span class="dd-check material-symbols-outlined text-secondary text-[18px] flex-none">check</span></button>
          ${operators.map(o => `<button data-val="${esc(o)}" class="dd-opt w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-on-surface"><span class="truncate">${esc(o)}</span><span class="dd-check material-symbols-outlined text-secondary text-[18px] flex-none invisible">check</span></button>`).join('')}
        </div>
      </div>
      <div class="relative flex-1 min-w-0" data-dd="scope">
        <button type="button" class="dd-trigger w-full flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/60 rounded-lg pl-3 pr-2 py-2.5 text-[12px] font-semibold text-on-surface">
          <span class="material-symbols-outlined text-on-surface-variant text-[18px] flex-none">assignment</span>
          <span class="dd-label flex-1 min-w-0 truncate text-left">Todos os PACs</span>
          <span class="material-symbols-outlined text-on-surface-variant text-[20px] flex-none">expand_more</span>
        </button>
        <div class="dd-panel hidden absolute z-40 left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-2xl max-h-72 overflow-y-auto scroll-area py-1">
          <button data-val="" class="dd-opt w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-on-surface"><span class="truncate">Todos os PACs</span><span class="dd-check material-symbols-outlined text-secondary text-[18px] flex-none">check</span></button>
          ${DB.pacs.filter(p => DB.forms.some(f => f.pacId === p.id)).map(p => `
            <div class="flex items-center gap-1.5 px-3 pt-2 pb-1"><span class="material-symbols-outlined text-on-surface-variant text-[15px]">${p.icon}</span><span class="mono text-[10px] uppercase tracking-wide text-on-surface-variant">${esc(p.code)} · ${esc(p.name)}</span></div>
            <button data-val="pac:${p.id}" class="dd-opt w-full flex items-center justify-between gap-2 pl-9 pr-3 py-2 text-left text-[13px] font-medium text-on-surface"><span class="truncate">Todo o ${esc(p.code)}</span><span class="dd-check material-symbols-outlined text-secondary text-[18px] flex-none invisible">check</span></button>
            ${DB.forms.filter(f => f.pacId === p.id).map(f => `<button data-val="form:${f.id}" class="dd-opt w-full flex items-center justify-between gap-2 pl-9 pr-3 py-2 text-left text-[13px] text-on-surface"><span class="truncate">${esc(f.title)}</span><span class="dd-check material-symbols-outlined text-secondary text-[18px] flex-none invisible">check</span></button>`).join('')}
          `).join('')}
        </div>
      </div>
    </div>` : ''}
    <div id="hist-list" class="space-y-2"></div>
    <div id="hist-empty" class="hidden flex-col items-center py-10 text-center">${icon('search_off', 'text-on-surface-variant text-[40px]')}<p class="font-semibold text-on-surface mt-2">Nenhum registro encontrado</p><p class="text-[12px] text-on-surface-variant">Ajuste a busca ou os filtros.</p></div>
  </div>`;
}

function histCard(s, showAssinar) {
  const f = getForm(s.formId); const pac = getPac(f.pacId);
  const meta = showAssinar
    ? `<span class="truncate">${esc(s.operatorName)} às ${fmtTime(s.ts)}</span>`
    : `<span class="truncate">Enviado às ${fmtTime(s.ts)}</span>`;
  const extra = s.occurrence ? `<div class="text-[11px] text-nc-tx font-medium truncate mt-0.5">Não conforme: ${esc(s.occurrence.issues[0])}</div>` : '';
  let trailing;
  if (showAssinar) {
    trailing = s.signedBy
      ? `<span class="flex items-center gap-1 text-[11px] font-semibold text-secondary flex-none">${icon('verified', 'text-[16px]', true)} Assinado</span>`
      : `<button data-action="sign" data-sub="${s.id}" class="tap flex items-center gap-1.5 bg-primary text-on-primary text-[12px] font-semibold px-3 py-1.5 rounded-lg flex-none">${icon('draw', 'text-[16px]')} Assinar</button>`;
  } else {
    trailing = icon('chevron_right', 'text-on-surface-variant flex-none');
  }
  return pcard({ icon: pac.icon, occ: s.occurrence, title: f.title, meta, extra, trailing, open: `data-action="open-sub" data-sub="${s.id}"` });
}

function bindHist(subs, showAssinar) {
  let filt = 'todos', op = 'Todos', q = '', scope = '';
  const list = $('hist-list'), empty = $('hist-empty'), search = $('hist-search');
  function apply() {
    let rows = subs.filter(s => {
      const f = getForm(s.formId), pac = getPac(f.pacId);
      if (filt === 'hoje' && !isToday(s.ts)) return false;
      if (filt === 'ocorrencia' && !s.occurrence) return false;
      if (filt === 'assinar' && s.signedBy) return false;
      if (op !== 'Todos' && s.operatorName !== op) return false;
      if (scope.startsWith('pac:') && f.pacId !== scope.slice(4)) return false;
      if (scope.startsWith('form:') && f.id !== scope.slice(5)) return false;
      if (q) { const t = (f.title + ' ' + pac.name + ' ' + s.operatorName).toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    });
    if (!rows.length) { list.innerHTML = ''; empty.classList.remove('hidden'); empty.classList.add('flex'); }
    else {
      empty.classList.add('hidden'); empty.classList.remove('flex');
      const groups = {};
      rows.forEach(s => { const d = new Date(s.ts); const k = isToday(s.ts) ? 'Hoje' : (todayKey(s.ts) === todayKey(isoAt(-1, 0, 0)) ? 'Ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })); (groups[k] = groups[k] || []).push(s); });
      list.innerHTML = Object.entries(groups).map(([k, arr]) => { const isHoje = k === 'Hoje'; return `<div class="flex items-center gap-2 pt-1"><span class="w-2 h-2 rounded-full ${isHoje ? 'bg-secondary' : 'bg-outline-variant'}"></span><span class="mono text-[10px] uppercase tracking-widest ${isHoje ? 'text-on-surface' : 'text-on-surface-variant'} font-semibold">${k}</span><span class="mono text-[10px] text-on-surface-variant">· ${arr.length} registro${arr.length > 1 ? 's' : ''}</span></div>` + arr.map(s => histCard(s, showAssinar)).join(''); }).join('');
    }
  }
  document.querySelectorAll('.filt-btn').forEach(b => b.onclick = () => { filt = b.dataset.filt; document.querySelectorAll('.filt-btn').forEach(x => x.className = 'filt-btn tap whitespace-nowrap text-[13px] font-semibold px-3.5 py-1.5 rounded-full ' + filtInactiveCls(x.dataset.filt)); b.className = 'filt-btn tap whitespace-nowrap text-[13px] font-semibold px-3.5 py-1.5 rounded-full ' + filtActiveCls(); apply(); });
  const opLabel = v => v === 'Todos' ? 'Todos os operadores' : v;
  const scopeLabel = v => { if (!v) return 'Todos os PACs'; if (v.startsWith('pac:')) { const p = getPac(v.slice(4)); return 'Todo o ' + (p ? p.code : ''); } const f = getForm(v.slice(5)); return f ? f.title : 'Planilha'; };
  function wireDD(key) {
    const wrap = document.querySelector(`[data-dd="${key}"]`); if (!wrap) return;
    const trigger = wrap.querySelector('.dd-trigger'), panel = wrap.querySelector('.dd-panel'), label = wrap.querySelector('.dd-label');
    trigger.onclick = (e) => { e.stopPropagation(); const wasOpen = !panel.classList.contains('hidden'); document.querySelectorAll('.dd-panel').forEach(p => p.classList.add('hidden')); if (!wasOpen) panel.classList.remove('hidden'); };
    panel.querySelectorAll('[data-val]').forEach(opt => opt.onclick = (e) => {
      e.stopPropagation(); const val = opt.dataset.val;
      if (key === 'op') { op = val; label.textContent = opLabel(val); } else { scope = val; label.textContent = scopeLabel(val); }
      panel.querySelectorAll('.dd-check').forEach(c => c.classList.add('invisible'));
      const chk = opt.querySelector('.dd-check'); if (chk) chk.classList.remove('invisible');
      panel.classList.add('hidden'); apply();
    });
  }
  wireDD('op'); wireDD('scope');
  if (!window.__ddBound) { window.__ddBound = true; document.addEventListener('click', () => document.querySelectorAll('.dd-panel').forEach(p => p.classList.add('hidden'))); }
  if (search) search.oninput = () => { q = search.value.toLowerCase().trim(); apply(); };
  apply();
}

/* ===== Exportar (PDF/CSV) ===== */
export function exportSheet() {
  const fmtISO = d => d.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return fmtISO(d); };
  const SPAN = { hoje: 0, '7': 7, '30': 30, '90': 90, tudo: null };
  const today = new Date(), d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const todayISO = fmtISO(today);
  const cap = iso => iso && iso > todayISO ? todayISO : iso;
  window.__exp = { fmt: 'pdf', preset: '30', span: 30 };
  const presetCls = on => 'preset-btn tap text-[12px] font-semibold px-3 py-1.5 rounded-full ' + (on ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant');
  const preset = (v, l) => `<button data-preset="${v}" class="${presetCls(v === window.__exp.preset)}">${l}</button>`;
  const fmtBtn = (v, l, ic) => `<button data-fmt="${v}" class="fmt-btn tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold ${window.__exp.fmt === v ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}">${icon(ic, 'text-[18px]')} ${l}</button>`;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[400px] shadow-2xl p-4">
      <div class="flex items-center gap-3 pb-3 border-b border-outline-variant/40">
        <div class="flex-1"><div class="font-semibold text-on-surface">Baixar registros</div><div class="text-[12px] text-on-surface-variant">Escolha o período e o formato</div></div>
        <button data-action="close-x" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
      </div>
      <p class="mono text-[10px] uppercase text-on-surface-variant mt-4 mb-2">Período</p>
      <div class="flex flex-wrap gap-2 mb-3">${preset('hoje', 'Hoje')}${preset('7', '7 dias')}${preset('30', '30 dias')}${preset('90', 'Trimestre')}${preset('tudo', 'Tudo')}</div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">De</label><input type="date" id="exp-from" max="${fmtISO(today)}" value="${fmtISO(d30)}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 text-[13px] text-on-surface border border-transparent focus:border-primary"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Até</label><input type="date" id="exp-to" max="${fmtISO(today)}" value="${fmtISO(today)}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2 text-[13px] text-on-surface border border-transparent focus:border-primary"></div>
      </div>
      <p class="mono text-[10px] uppercase text-on-surface-variant mt-4 mb-2">Formato</p>
      <div class="flex gap-2">${fmtBtn('pdf', 'PDF', 'picture_as_pdf')}${fmtBtn('csv', 'CSV', 'table_view')}</div>
      <button data-action="run-export" class="tap w-full mt-4 bg-primary text-on-primary rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 text-[14px]">${icon('download', '', true)} Baixar</button>
    </div></div>`;
  function paintPresets() { document.querySelectorAll('.preset-btn').forEach(b => b.className = presetCls(b.dataset.preset === window.__exp.preset)); }
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
    const n = b.dataset.preset; window.__exp.preset = n; window.__exp.span = SPAN[n];
    const to = fmtISO(new Date());
    if (n === 'tudo') { $('exp-from').value = ''; $('exp-to').value = to; }
    else { $('exp-to').value = to; $('exp-from').value = n === 'hoje' ? to : addDays(to, -SPAN[n]); }
    paintPresets();
  });
  $('exp-from').onchange = () => { let fr = cap($('exp-from').value); $('exp-from').value = fr; if (window.__exp.span != null && fr) { $('exp-to').value = cap(addDays(fr, window.__exp.span)); } };
  $('exp-to').onchange = () => { let t = cap($('exp-to').value); $('exp-to').value = t; if (window.__exp.span != null && t) { $('exp-from').value = addDays(t, -window.__exp.span); } };
  document.querySelectorAll('.fmt-btn').forEach(b => b.onclick = () => { window.__exp.fmt = b.dataset.fmt; document.querySelectorAll('.fmt-btn').forEach(x => { const on = x.dataset.fmt === window.__exp.fmt; x.className = 'fmt-btn tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold ' + (on ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'); }); });
}

export function runExport(closeModal) {
  const from = $('exp-from').value, to = $('exp-to').value, fmt = window.__exp.fmt;
  const f = from ? new Date(from + 'T00:00:00') : null, t = to ? new Date(to + 'T23:59:59') : null;
  const rows = DB.submissions.filter(s => { const d = new Date(s.ts); if (f && d < f) return false; if (t && d > t) return false; return true; });
  if (!rows.length) { toast('Nenhum registro no período.', 'info'); return; }
  const br = x => x ? new Date(x + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
  const label = `${from ? br(from) : 'início'} a ${to ? br(to) : 'hoje'}`;
  closeModal();
  if (fmt === 'csv') exportHistCsv(rows); else exportReportPdf(rows, label);
}
