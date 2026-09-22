import { currentUser } from './state.js';
import { esc, icon } from './helpers.js';
import { STATUS_META } from './config.js';

export function logo(size = 'text-2xl') {
  return `<span class="font-brand ${size} tracking-tight leading-none"><span class="text-secondary">meu</span><span class="text-primary">PAC</span></span>`;
}
export function topbar(right) {
  return `<header class="shrink-0 z-30 bg-surface/90 backdrop-blur border-b border-outline-variant/40 pt-safe">
    <div class="flex items-center justify-between px-4 h-14">
      ${logo('text-[18px]')}
      <div class="flex items-center gap-3">${right || ''}</div>
    </div></header>`;
}
export function avatarBtn() {
  const u = currentUser;
  return `<button data-action="profile" class="tap w-9 h-9 rounded-full flex items-center justify-center font-mono text-[12px] font-bold" style="background:${u.color};color:${u.ink}">${u.initials}</button>`;
}
export function profileTrigger() {
  const u = currentUser;
  return `<button data-action="profile" class="tap flex items-center gap-2.5">
     <span class="text-[14px] font-semibold text-on-surface whitespace-nowrap">Olá, ${esc(u.name.split(' ').slice(0, 2).join(' '))}</span>
     <span class="w-9 h-9 rounded-full flex items-center justify-center font-mono text-[12px] font-bold flex-none" style="background:${u.color};color:${u.ink}">${u.initials}</span>
   </button>`;
}
export function bottomNav(items, active) {
  return `<nav class="shrink-0 z-30 bg-surface-container-lowest border-t border-outline-variant/50 pb-safe">
    <div class="grid grid-cols-${items.length} px-1">
      ${items.map(it => { const on = it.key === active; return `<button data-action="nav" data-nav="${it.key}" class="tap flex flex-col items-center gap-0.5 py-2.5">
        <span class="material-symbols-outlined text-[24px] ${on ? 'ms-fill text-primary' : 'text-on-surface-variant'}" ${on ? `style="background:#dfe9fb;border-radius:16px;padding:2px 16px"` : ''}>${it.icon}</span>
        <span class="text-[11px] ${on ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'}">${it.label}</span>
      </button>`; }).join('')}
    </div></nav>`;
}
export function shell(inner, navItems, active, right) {
  return `<div class="flex flex-col h-full">
    ${topbar(right)}
    <main id="screen-scroll" class="flex-1 overflow-y-auto scroll-area ${window.__noAnim ? '' : 'screen-enter'}">${inner}</main>
    ${bottomNav(navItems, active)}
  </div>`;
}
export function statusChip(st, extra = '') {
  const m = STATUS_META[st]; if (!m) return '';
  return `<span class="mono inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${m.bg} ${m.tx} ${extra}">
    <span class="w-1.5 h-1.5 rounded-full" style="background:${m.dot}"></span>${m.label}</span>`;
}
export function secHead(title, n) { return `<p class="mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">${esc(title)} · ${n}</p>`; }

// card único de planilha/registro: ícone · título · meta(operador · horário) · ação à direita; faixa vermelha = ocorrência
export function pcard(o) {
  const occ = !!o.occ;
  return `<div ${o.open || ''} class="tap w-full flex items-center gap-3 bg-surface-container-lowest border ${occ ? 'border-l-4 border-l-nc-bd ' : ''}border-outline-variant/60 rounded-xl px-3.5 py-3 text-left">
    <span class="w-9 h-9 rounded-lg ${occ ? 'bg-nc-bg' : 'bg-surface-container'} flex items-center justify-center flex-none">${icon(o.icon, (occ ? 'text-nc-tx' : 'text-primary') + ' text-[20px]', true)}</span>
    <div class="flex-1 min-w-0">
      <div class="font-medium text-on-surface text-[14px] truncate">${esc(o.title)}</div>
      ${o.meta ? `<div class="flex items-center gap-1 mt-0.5 min-w-0 text-[11px] text-on-surface-variant">${o.meta}</div>` : ''}
      ${o.extra || ''}
    </div>
    ${o.trailing || ''}
  </div>`;
}
