import { $, esc, icon, toast } from '../helpers.js';
import { DB, params, getForm, getPac, pacActive, formActive, dueText, revLabel } from '../state.js';
import { shell, profileTrigger } from '../ui.js';
import { GE_NAV } from '../config.js';
import * as api from '../api.js';
import { navigate, rerender } from '../router.js';

const app = () => $('app');

export function renderForms() {
  const inner = `<div class="px-4 py-5 space-y-4">
    <div class="flex items-center justify-between">
      <div><h1 class="text-[26px] font-bold text-on-surface leading-tight">PACs</h1><p class="text-[13px] text-on-surface-variant">Ative os PACs da sua unidade e gerencie as planilhas de cada um.</p></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-surface-container rounded-xl p-3 text-center"><div class="text-[22px] font-bold text-on-surface">${DB.pacs.filter(pacActive).length}<span class="text-[13px] text-on-surface-variant">/${DB.pacs.length}</span></div><div class="mono text-[9px] uppercase text-on-surface-variant">PACs ativos</div></div>
      <div class="bg-surface-container rounded-xl p-3 text-center"><div class="text-[22px] font-bold text-on-surface">${DB.forms.filter(f => formActive(f) && pacActive(getPac(f.pacId))).length}<span class="text-[13px] text-on-surface-variant">/${DB.forms.length}</span></div><div class="mono text-[9px] uppercase text-on-surface-variant">Planilhas ativas</div></div>
    </div>
    <div class="space-y-2">${DB.pacs.map(p => { const fs = DB.forms.filter(f => f.pacId === p.id); const on = pacActive(p);
      return `<div class="flex items-center bg-surface-container-lowest border border-outline-variant/60 rounded-xl ${on ? '' : 'opacity-60'}">
        <button data-action="open-pac" data-pac="${p.id}" class="tap flex-1 flex items-center gap-3 pl-2 pr-4 py-3 text-left min-w-0">
          <span class="w-9 flex items-center justify-center flex-none">${icon(p.icon, (on ? 'text-primary' : 'text-outline-variant') + ' text-[24px]', true)}</span>
          <div class="flex-1 min-w-0"><div class="font-semibold text-on-surface text-[14px] truncate">${p.code} · ${esc(p.name)}</div>
          <div class="text-[11px] text-on-surface-variant truncate">${fs.length} planilha${fs.length !== 1 ? 's' : ''}</div></div>
          ${on ? '' : `<span class="mono text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant flex-none">Inativo</span>`}
          ${icon('chevron_right', 'text-on-surface-variant flex-none')}
        </button>
        <span data-action="toggle-pac-active" data-pac="${p.id}" class="toggle ${on ? 'on' : ''} flex-none mr-3"></span>
      </div>`; }).join('')}</div>
  </div>`;
  app().innerHTML = shell(inner, GE_NAV, 'ge_forms', profileTrigger());
}

export function renderPacForms() {
  const p = getPac(params.pac); if (!p) { navigate('ge_forms'); return; }
  const fs = DB.forms.filter(f => f.pacId === p.id);
  const inner = `<div class="px-4 py-4 space-y-4">
    <button data-action="nav" data-nav="ge_forms" class="tap inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">${icon('arrow_back', 'text-[18px]')} Voltar para PACs</button>
    <div class="flex items-center gap-3">
      <span class="w-10 flex items-center justify-center flex-none">${icon(p.icon, (pacActive(p) ? 'text-primary' : 'text-outline-variant') + ' text-[32px]', true)}</span>
      <h1 class="text-[22px] font-bold text-on-surface leading-tight">${p.code} · ${esc(p.name)}</h1>
    </div>
    ${p.description ? `<div class="bg-surface-container rounded-xl p-3.5">
      <div class="mono text-[10px] uppercase tracking-wide text-secondary font-semibold mb-1">${esc(p.norm)}</div>
      <p class="text-[13px] text-on-surface-variant">${esc(p.description)}</p>
    </div>` : ''}
    <button data-action="new-form" data-pac="${p.id}" class="tap w-full flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl py-3 font-semibold text-[14px]">${icon('add_circle', '', true)} Nova Planilha</button>
    <div class="space-y-2">
    ${fs.map(f => { const on = formActive(f); return `<div class="flex items-center bg-surface-container-lowest border border-outline-variant/60 rounded-xl ${on ? '' : 'opacity-60'}">
      <button data-action="config-form" data-form="${f.id}" class="tap flex-1 min-w-0 text-left p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="mono text-[11px] font-semibold text-on-surface">PL ${String(f.plNum || 0).padStart(2, '0')} <span class="text-on-surface-variant">· ${revLabel(f)}</span></span>
          ${on ? '' : `<span class="mono text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant flex-none">Inativa</span>`}
        </div>
        <div class="font-semibold text-on-surface text-[15px] mt-0.5">${esc(f.title)}</div>
        <div class="mono flex items-center gap-1 text-[10px] text-on-surface-variant truncate mt-1">${icon('schedule', 'text-[14px] flex-none')} <span class="truncate">${esc(dueText(f))}</span></div>
        <div class="flex items-center gap-1 text-[11px] text-on-surface-variant mt-1">${icon('location_on', 'text-[14px]')} ${esc(f.location)}</div>
      </button>
      ${icon('chevron_right', 'text-on-surface-variant flex-none')}
      <span data-action="toggle-form-active" data-form="${f.id}" class="toggle ${on ? 'on' : ''} flex-none ml-2 mr-4"></span>
    </div>`; }).join('')}
    </div>
  </div>`;
  app().innerHTML = shell(inner, GE_NAV, 'ge_forms', profileTrigger());
}

export async function togglePacActive(pacId) {
  const p = getPac(pacId); if (!p) return;
  try {
    await api.setPacActive(pacId, !pacActive(p));
    await api.refreshState();
    rerender(renderForms);
    toast(pacActive(getPac(pacId)) ? esc(p.name) + ' ativado.' : esc(p.name) + ' desativado.', 'info');
  } catch (e) { toast(e.message || 'Não foi possível alterar o PAC.', 'err'); }
}

export async function toggleFormActive(formId) {
  const f = getForm(formId); if (!f) return;
  try {
    await api.setFormActive(formId, !formActive(f));
    await api.refreshState();
    rerender(() => renderPacForms());
    toast(formActive(getForm(formId)) ? esc(f.title) + ' ativada.' : esc(f.title) + ' desativada.', 'info');
  } catch (e) { toast(e.message || 'Não foi possível alterar a planilha.', 'err'); }
}
