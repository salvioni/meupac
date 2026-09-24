import { $, esc, icon, fmtTime, isToday, toast } from '../helpers.js';
import { DB, getForm, getPac, pacActive, formActive, formStatus, dueMinutesToday, ownerName, dueText, openSlots, isCada, formSlots, dayProgress } from '../state.js';
import { shell, profileTrigger, pcard, secHead } from '../ui.js';
import { GE_NAV, STATUS_META } from '../config.js';
import * as api from '../api.js';
import { rerender } from '../router.js';
import { toMin } from '../schedule.js';

const app = () => $('app');

function computeStats() {
  const today = DB.submissions.filter(s => isToday(s.ts));
  const nc = today.filter(s => s.occurrence);
  const toSign = today.filter(s => !s.signedBy);
  const signed = today.filter(s => s.signedBy && !s.occurrence);
  const dueMin = f => { const m = dueMinutesToday(f); return m === null ? Infinity : m; };
  // linhas de "aguardando preenchimento": uma por horário em aberto (atrasados + o próximo,
  // ex.: "Temperatura · 08:00", "· 10:00"); em "cada pessoa", uma por pessoa que ainda
  // falta em cada um desses horários (ex.: "Uniforme · Clara"). Sem horários, uma por planilha.
  const awaiting = [];
  DB.forms.filter(f => formActive(f) && pacActive(getPac(f.pacId))).forEach(f => {
    const st = formStatus(f);
    if (!['atrasado', 'pendente', 'afazer'].includes(st)) return;
    if (isCada(f)) {
      const before = awaiting.length;
      if (formSlots(f).length) openSlots(f).forEach(x => x.faltam.forEach(t => awaiting.push({ f, st: x.status, min: toMin(x.slot), when: x.label || x.slot, who: t.name })));
      else dayProgress(f).faltam.forEach(t => awaiting.push({ f, st: 'afazer', min: Infinity, when: dueText(f).split(' · ')[0], who: t.name }));
      if (awaiting.length > before) return;
      // ninguém designado/do turno: cai na linha única de sempre
    }
    if (formSlots(f).length) {
      const open = openSlots(f);
      if (open.length) { open.forEach(x => awaiting.push({ f, st: x.status, min: toMin(x.slot), when: x.label || x.slot, who: ownerName(f) })); return; }
    }
    awaiting.push({ f, st, min: dueMin(f), when: whenLabel(f), who: ownerName(f) });
  });
  awaiting.sort((a, b) => (a.st === 'atrasado' ? 0 : 1) - (b.st === 'atrasado' ? 0 : 1) || a.min - b.min || a.f.title.localeCompare(b.f.title));
  return { nc, toSign, signed, awaiting };
}

// planilha sem horários (as com horário viram uma linha por horário): a frequência
const whenLabel = f => dueText(f).split(' · ')[0];

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

  const awaitRows = awaiting.map(({ f, st, when, who }) => {
    return pcard({
      icon: getPac(f.pacId).icon, occ: false, title: f.title,
      meta: `${icon('schedule', 'text-[14px] flex-none')}<span class="truncate">${esc(when)} · ${esc(who)}</span>`,
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
