export const $ = (id) => document.getElementById(id);

export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function icon(name, cls = '', fill = false) { return `<span class="material-symbols-outlined ${fill ? 'ms-fill' : ''} ${cls}">${name}</span>`; }
export function fmtTime(iso) { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
export function fmtDT(iso) { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + fmtTime(iso); }
export function fmtDTShort(iso) { const d = new Date(iso); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' às ' + fmtTime(iso); }
export function todayKey(iso) { const d = new Date(iso); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
export function isToday(iso) { return todayKey(iso) === todayKey(new Date().toISOString()); }
export function isoAt(dayOffset, h, m) { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.toISOString(); }

// A "prova de autenticidade" agora é o hash calculado e assinado pelo servidor
// (cadeia sha256 em backend/src/hash.js), não mais um rótulo cosmético local.
export function hashFor(sub) { return sub.hash ? sub.hash.slice(0, 16).toUpperCase() : '—'; }

export function toast(msg, kind = 'ok') {
  const c = kind === 'ok' ? 'bg-primary text-on-primary' : kind === 'err' ? 'bg-error text-on-error' : 'bg-inverse-surface text-inverse-on-surface';
  const ic = kind === 'ok' ? 'check_circle' : kind === 'err' ? 'error' : 'info';
  $('toast').innerHTML = `<div class="sheet-enter ${c} rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 text-[13px] font-semibold max-w-[380px] mx-4">${icon(ic, 'text-[20px]', true)}<span>${esc(msg)}</span></div>`;
  clearTimeout(window.__t); window.__t = setTimeout(() => { $('toast').innerHTML = ''; }, 2600);
}
