import { $, esc, icon, fmtTime, isToday, toast } from '../helpers.js';
import { DB, getForm, getPac, pacActive, formActive, formStatus, dueMinutesToday, ownerName, dueText, slotStates, openSlots } from '../state.js';
import { shell, profileTrigger, pcard, secHead } from '../ui.js';
import { GE_NAV, STATUS_META } from '../config.js';
import * as api from '../api.js';
import { rerender } from '../router.js';

const app = () => $('app');

function computeStats() {
  const today = DB.submissions.filter(s => isToday(s.ts));
  const nc = today.filter(s => s.occurrence);
  const toSign = today.filter(s => !s.signedBy);
  const signed = today.filter(s => s.signedBy && !s.occurrence);
  const dueMin = f => { const m = dueMinutesToday(f); return m === null ? Infinity : m; };
  const awaiting = DB.forms.filter(f => { const st = formStatus(f); return ['atrasado', 'pendente', 'afazer'].includes(st) && formActive(f) && pacActive(getPac(f.pacId)); })
    .sort((a, b) => (formStatus(a) === 'atrasado' ? 0 : 1) - (formStatus(b) === 'atrasado' ? 0 : 1) || dueMin(a) - dueMin(b));
  return { nc, toSign, signed, awaiting };
}

// planilha com vários horários: próximo horário em aberto + progresso do dia
// (ex.: "10:00 · 2 de 7 hoje"); sem horários, a descrição da frequência.
function whenLabel(f) {
  const states = slotStates(f);
  if (states.length > 1) {
    const open = openSlots(f), feitos = states.filter(x => x.sub).length;
    return `${open.length ? open[0].slot + ' · ' : ''}${feitos} de ${states.length} hoje`;
  }
  return dueText(f).split(' · ')[0];
}

export function renderPainel() {
  const { nc, toSign, signed, awaiting } = computeStats();
  const stat = (bg, tx, val, label, ic, valTx) => `<div class="${bg} rounded-xl p-3.5">
    <div class="flex items-center justify-between"><span class="mono text-[10px] uppercase tracking-wide ${tx} opacity-80">${label}</span>${icon(ic, tx + ' text-[18px]', true)}</div>
    <div class="text-[30px] font-bold ${valTx || tx} leading-none mt-1">${String(val).padStart(2, '0')}</div></div>`;

  const ncCards = nc.map(s => {
    const f = getForm(s.formId), pac = getPac(f.pacId);
    return pcard({
      icon: pac.icon, occ: true, title: f.title,
      meta: `<span class="truncate">${s.slot ? `Registro das ${s.slot} · ` : ''}${esc(s.operatorName)} às ${fmtTime(s.ts)}</span>`,
      extra: `<div class="text-[11px] text-nc-tx font-semibold truncate mt-0.5">${esc(s.occurrence.issues[0])}</div>`,
      trailing: icon('chevron_right', 'text-on-surface-variant flex-none'),
      open: `data-action="open-sub" data-sub="${s.id}"`,
    });
  }).join('');

  const signRows = toSign.map(s => {
    const f = getForm(s.formId);
    return pcard({
      icon: getPac(f.pacId).icon, occ: s.occurrence, title: f.title,
      meta: `<span class="truncate">${s.slot ? `Registro das ${s.slot} · ` : ''}${esc(s.operatorName)} às ${fmtTime(s.ts)}</span>`,
      trailing: `<button data-action="sign" data-sub="${s.id}" class="tap flex items-center gap-1.5 bg-primary text-on-primary text-[12px] font-semibold px-3 py-2 rounded-lg flex-none">${icon('draw', 'text-[16px]')} Assinar</button>`,
      open: `data-action="open-sub" data-sub="${s.id}"`,
    });
  }).join('');

  const awaitRows = awaiting.map(f => {
    const st = formStatus(f);
    return pcard({
      icon: getPac(f.pacId).icon, occ: false, title: f.title,
      meta: `${icon('schedule', 'text-[14px] flex-none')}<span class="truncate">${esc(whenLabel(f))} · ${esc(ownerName(f))}</span>`,
      trailing: st === 'atrasado'
        ? `<span class="mono text-[10px] font-bold uppercase px-2 py-1 rounded ${STATUS_META.atrasado.bg} ${STATUS_META.atrasado.tx} flex-none">${STATUS_META.atrasado.label}</span>`
        : `<span class="mono text-[10px] font-semibold uppercase px-2 py-1 rounded bg-surface-container text-on-surface-variant flex-none">No Prazo</span>`,
    });
  }).join('');

  const inner = `<div class="px-4 py-5 space-y-5">
    <div><h1 class="text-[26px] font-bold text-on-surface leading-tight">Painel de Hoje</h1><p class="text-[13px] text-on-surface-variant">Conformidades, alertas e assinaturas do dia — atualizado em tempo real.</p></div>
    <div class="grid grid-cols-2 gap-3">
      ${stat('bg-nc-bg', 'text-nc-tx', nc.length, 'Não Conformes', 'warning')}
      ${stat('bg-inverse-primary', 'text-primary', toSign.length, 'A Assinar', 'draw')}
      ${stat('bg-conf-bg', 'text-conf-tx', signed.length, 'Conformes OK', 'verified')}
      ${stat('bg-surface-container-high', 'text-primary', awaiting.length, 'A Preencher', 'pending_actions', 'text-on-surface-variant')}
    </div>
    ${nc.length ? `<div>${secHead('Não Conformidades', nc.length)}<div class="space-y-2">${ncCards}</div></div>` : ''}
    ${toSign.length ? `<div>${secHead('Aguardando Assinatura', toSign.length)}
      <div class="space-y-2">${signRows}</div>
      ${toSign.length > 1 ? `<button data-action="sign-all" class="tap w-full mt-3 bg-primary text-on-primary rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 text-[14px]">${icon('done_all', '', true)} Assinar todos os ${toSign.length} registros</button>` : ''}</div>` : ''}
    ${awaiting.length ? `<div>${secHead('Aguardando Preenchimento', awaiting.length)}<div class="space-y-2">${awaitRows}</div></div>` : ''}
    <div class="h-1"></div>
  </div>`;
  app().innerHTML = shell(inner, GE_NAV, 'ge_painel', profileTrigger());
}

export async function sign(id) {
  try { await api.signSubmission(id); await api.refreshState(); toast('Planilha assinada digitalmente.'); rerender(); }
  catch (e) { toast(e.message || 'Não foi possível assinar.', 'err'); }
}
export async function signAll() {
  try { const signed = await api.signAllToday(); await api.refreshState(); toast(`${signed.length} registros assinados.`); rerender(); }
  catch (e) { toast(e.message || 'Não foi possível assinar todas.', 'err'); }
}
