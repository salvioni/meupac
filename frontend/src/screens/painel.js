import { $, esc, icon, fmtTime, isToday, toast } from '../helpers.js';
import { DB, getForm, getPac, pacActive, formActive, formStatus, dueMinutesToday, formOwners, slotVisibleTo, dueText, pendingSlots, isCada, formSlots, dayProgress } from '../state.js';
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
  // linhas de "aguardando preenchimento": uma por horário ainda sem envio no dia inteiro
  // (ex.: "Temperatura · 08:00", "· 10:00"…), atrasados em cima; em "cada pessoa", uma por pessoa que ainda
  // falta em cada um desses horários (ex.: "Uniforme · Clara"). Sem horários, uma por planilha.
  const awaiting = [];
  DB.forms.filter(f => formActive(f) && pacActive(getPac(f.pacId))).forEach(f => {
    const st = formStatus(f);
    if (!['atrasado', 'pendente', 'afazer'].includes(st)) return;
    if (isCada(f)) {
      const before = awaiting.length;
      if (formSlots(f).length) pendingSlots(f).forEach(x => x.faltam.forEach(t => awaiting.push({ f, st: x.status, min: toMin(x.slot), when: x.label || x.slot, who: t.name })));
      else dayProgress(f).faltam.forEach(t => awaiting.push({ f, st: 'afazer', min: Infinity, when: dueText(f).split(' · ')[0], who: t.name }));
      if (awaiting.length > before) return;
      // ninguém designado/do turno: cai na linha única de sempre
    }
    if (formSlots(f).length) {
      const open = pendingSlots(f);
      if (open.length) { open.forEach(x => awaiting.push({ f, st: x.status, min: toMin(x.slot), when: x.label || x.slot, who: eitherName(f, x) })); return; }
    }
    awaiting.push({ f, st, min: dueMin(f), when: whenLabel(f), who: eitherName(f) });
  });
  awaiting.sort((a, b) => (a.st === 'atrasado' ? 0 : 1) - (b.st === 'atrasado' ? 0 : 1) || a.min - b.min || a.f.title.localeCompare(b.f.title));
  return { nc, toSign, signed, awaiting };
}

// "basta um" com mais de uma pessoa: "João ou Mariana" (qualquer um deles faz, não os
// dois). Com vários nomes, só o primeiro nome de cada, pra caber na linha.
// slot: só quem é do turno daquele horário (o Carlos, do 2º turno, não faz o das 06:00)
function eitherName(f, slot = null) {
  const all = formOwners(f), turno = slot ? all.filter(u => slotVisibleTo(u)(slot)) : all;
  const names = (turno.length ? turno : all).map(u => u.name);
  if (names.length < 2) return names[0] || '—';
  const first = names.map(n => n.split(' ')[0]);
  return first.slice(0, -1).join(', ') + ' ou ' + first[first.length - 1];
}

// planilha sem horários (as com horário viram uma linha por horário): a frequência
const whenLabel = f => dueText(f).split(' · ')[0];

export function renderPainel() {
  const { nc, toSign, signed, awaiting } = computeStats();
  const toSignOk = toSign.filter(s => !s.occurrence); // conformes a assinar (vêm depois das NC na lista)
  const stat = (bg, tx, val, label, ic, valTx) => `<div class="${bg} rounded-xl p-3.5">
    <div class="flex items-center justify-between"><span class="mono text-[10px] uppercase tracking-wide ${tx} opacity-80">${label}</span>${icon(ic, tx + ' text-[18px]', true)}</div>
    <div class="text-[30px] font-bold ${valTx || tx} leading-none mt-1">${String(val).padStart(2, '0')}</div></div>`;

  // a não conformidade aparece só aqui (com o Assinar), não também em "aguardando
  // assinatura" — senão parece que são dois registros
  const signBtn = s => `<button data-action="sign" data-sub="${s.id}" class="tap flex items-center gap-1.5 bg-primary text-on-primary text-[12px] font-semibold px-3 py-2 rounded-lg flex-none">${icon('draw', 'text-[16px]')} Assinar</button>`;
  const subCard = s => {
    const f = getForm(s.formId);
    return pcard({
      icon: getPac(f.pacId).icon, occ: !!s.occurrence, title: f.title,
      meta: `<span class="truncate">${s.slot ? `Registro das ${s.slot} · ` : ''}${esc(s.operatorName)} às ${fmtTime(s.ts)}</span>`,
      extra: s.occurrence ? `<div class="text-[11px] text-nc-tx font-semibold truncate mt-0.5">${esc(s.occurrence.issues[0])}</div>` : '',
      trailing: s.signedBy ? `<span class="flex items-center gap-1 text-[11px] font-semibold text-secondary flex-none">${icon('verified', 'text-[16px]', true)} Assinado</span>` : signBtn(s),
      open: `data-action="open-sub" data-sub="${s.id}"`,
    });
  };
  // "para assinar": uma lista só — não conformes a assinar, conformes a assinar e, no fim,
  // as não conformes já assinadas hoje (continuam visíveis como alerta do dia)
  const ncOpen = nc.filter(s => !s.signedBy), ncDone = nc.filter(s => s.signedBy);
  const signList = [...ncOpen, ...toSignOk, ...ncDone];
  const signHead = [toSign.length ? `${toSign.length} a assinar` : 'tudo assinado', nc.length ? `${nc.length} não conforme${nc.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');

  // aguardando preenchimento é só informativo (quem preenche é o operador): linhas num
  // cartão único com divisórias, como a lista da Equipe — sem cara de botão
  const awaitRows = awaiting.map(({ f, st, when, who }) => `<div class="flex items-center gap-3 px-3.5 py-3">
      <span class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center flex-none">${icon(getPac(f.pacId).icon, 'text-primary text-[20px]', true)}</span>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-on-surface text-[14px] truncate">${esc(f.title)}</div>
        <div class="flex items-center gap-1 mt-0.5 min-w-0 text-[11px] text-on-surface-variant">${icon('schedule', 'text-[14px] flex-none')}<span class="truncate">${esc(when)} · ${esc(who)}</span></div>
      </div>
      ${st === 'atrasado'
        ? `<span class="mono text-[10px] font-bold uppercase px-2 py-1 rounded ${STATUS_META.atrasado.bg} ${STATUS_META.atrasado.tx} flex-none">${STATUS_META.atrasado.label}</span>`
        : `<span class="mono text-[10px] font-semibold uppercase px-2 py-1 rounded bg-surface-container text-on-surface-variant flex-none">No Prazo</span>`}
    </div>`).join('');

  const inner = `<div class="px-4 py-5 space-y-5">
    <div><h1 class="text-[26px] font-bold text-on-surface leading-tight">Painel de Hoje</h1><p class="text-[13px] text-on-surface-variant">Conformidades, alertas e assinaturas do dia — atualizado em tempo real.</p></div>
    <div class="grid grid-cols-2 gap-3">
      ${stat('bg-nc-bg', 'text-nc-tx', nc.length, 'Não Conformes', 'warning')}
      ${stat('bg-inverse-primary', 'text-primary', toSign.length, 'A Assinar', 'draw')}
      ${stat('bg-conf-bg', 'text-conf-tx', signed.length, 'Conformes OK', 'verified')}
      ${stat('bg-surface-container-high', 'text-primary', awaiting.length, 'A Preencher', 'pending_actions', 'text-on-surface-variant')}
    </div>
    ${signList.length ? `<div><p class="mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">${signHead}</p>
      <div class="space-y-2">${signList.map(subCard).join('')}</div>
      ${toSign.length > 1 ? `<button data-action="sign-all" class="tap w-full mt-3 bg-primary text-on-primary rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 text-[14px]">${icon('done_all', '', true)} Assinar todos os ${toSign.length} registros</button>` : ''}</div>` : ''}
    ${awaiting.length ? `<div>${secHead('Aguardando Preenchimento', awaiting.length)}<div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl overflow-hidden divide-y divide-outline-variant/40">${awaitRows}</div></div>` : ''}
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
