import { $, esc, icon, toast } from '../helpers.js';
import { DB, currentUser, screen, isTitular, getPac, pacActive, dueText, plCode, unitTurnos, visibleToOperator } from '../state.js';
import { activeTurnos, DEFAULT_TURNOS, turnosDefinidos } from '../schedule.js';

// nome do turno de um operador (só faz sentido com 2 turnos ligados na unidade)
function turnoName(t) {
  const act = activeTurnos(unitTurnos());
  if (act.length < 2) return '';
  return act.some(x => x.idx === t.turnoIdx) ? `${t.turnoIdx + 1}º turno` : 'Ambos os turnos';
}
import { shell, profileTrigger } from '../ui.js';
import { GE_NAV } from '../config.js';
import * as api from '../api.js';
import { closeModal, rerender } from '../router.js';
import { turnosChanged } from './formEditor.js';

const app = () => $('app');
const avatarChip = (u) => `<span data-uid="${u.id}" title="${esc(u.name)}" class="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[8px] font-bold flex-none" style="background:${u.color || '#dfe9fb'};color:${u.ink || '#0f2642'}">${u.initials || '·'}</span>`;

export async function renderEquipe() {
  try { await api.fetchTeam(); } catch (e) { toast(e.message || 'Não foi possível carregar a equipe.', 'err'); }
  const team = DB.team || [];
  const memberRow = (t) => {
    const isOp = t.role === 'operador';
    const isSelf = t.id === currentUser.id;
    return `<div class="flex items-center gap-3 px-3 py-2.5">
      <div class="relative flex-none"><span class="w-9 h-9 rounded-full flex items-center justify-center font-mono text-[11px] font-bold" style="background:${t.color || '#dfe9fb'};color:${t.ink || '#0f2642'}">${t.initials || '·'}</span></div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-on-surface text-[14px] truncate">${esc(t.name)}${isSelf ? ' (você)' : ''}</div>
        ${isOp ? `<div class="flex items-center gap-1 text-[11px] text-on-surface-variant mt-0.5"><span class="truncate">${turnoName(t) ? `${turnoName(t)} · ` : ''}${accessText(t)}</span></div>` : ''}
      </div>
      <div class="flex items-center gap-2 flex-none">
        ${isTitular(t) ? `<span class="mono text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary text-on-primary">Admin</span>` : isOp ? `<span class="mono text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">Operador</span>` : `<span class="mono text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-inverse-primary text-primary">Gestor</span>`}
        ${t.canManage ? `<div class="flex items-center gap-0.5">
          <button data-action="edit-member" data-id="${t.id}" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-primary">${icon('tune', 'text-[18px]')}</button>
          <button data-action="reset-pass-member" data-id="${t.id}" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('key', 'text-[18px]')}</button>
          <button data-action="del-member" data-id="${t.id}" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-error">${icon('delete', 'text-[18px]')}</button>
        </div>` : ''}
      </div>
    </div>`;
  };

  const inner = `<div class="px-4 py-5 space-y-4">
    <div class="flex items-start justify-between">
      <div><h1 class="text-[26px] font-bold text-on-surface leading-tight">Equipe</h1><p class="text-[13px] text-on-surface-variant">Gerencie os membros e o acesso de cada um às planilhas.</p></div>
      <button data-action="invite" class="tap flex items-center gap-1.5 bg-secondary text-on-secondary text-[13px] font-semibold px-3 py-2 rounded-lg">${icon('person_add', 'text-[18px]')} Convidar</button>
    </div>
    ${turnosCard(team)}
    <p class="mono text-[10px] uppercase tracking-widest text-on-surface-variant">Membros · ${team.length}</p>
    <div class="bg-surface-container-lowest rounded-xl overflow-hidden divide-y divide-outline-variant/40">${[...team].sort((a, b) => (isTitular(a) ? 0 : a.role === 'operador' ? 2 : 1) - (isTitular(b) ? 0 : b.role === 'operador' ? 2 : 1)).map(memberRow).join('')}</div>
    <div class="bg-surface-container rounded-xl p-4 flex gap-2">${icon('shield', 'text-on-surface-variant flex-none', true)}<div class="flex-1"><p class="text-[12px] text-on-surface-variant">Trilha de auditoria com cadeia de hashes: qualquer alteração retroativa de um registro assinado é detectável.</p><button data-action="verify-audit" class="tap mt-2 text-[12px] font-semibold text-primary">Verificar agora</button></div></div>
  </div>`;
  app().innerHTML = shell(inner, GE_NAV, 'ge_equipe', profileTrigger());
}

// quantas planilhas a pessoa vê: as marcadas pra ela + as sem ninguém marcado (liberadas a todos)
function accessText(t) {
  const n = DB.forms.filter(f => visibleToOperator(f, t.id)).length;
  return `vê ${n} planilha${n !== 1 ? 's' : ''}`;
}

const inputCls = 'w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary';
const pickCls = on => `tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold ${on ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`;

// senha sugerida: fácil de ditar/anotar (sem 0/O, 1/l), 8 caracteres
function suggestPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}

export function inviteSheet() {
  const act = activeTurnos(unitTurnos());
  window.__inv = { role: 'operador', turno: act.length > 1 ? undefined : null }; // undefined = ainda não escolheu
  const turnoBtn = (v, label, sub) => `<button data-inv-turno="${v === null ? '' : v}" class="${pickCls(false)} flex-col !gap-0">${label}${sub ? `<span class="mono text-[10px] font-normal opacity-80">${sub}</span>` : ''}</button>`;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[380px] max-h-[88dvh] overflow-y-auto scroll-area shadow-2xl p-4">
      <div class="flex items-center gap-3 pb-3 border-b border-outline-variant/40">
        <div class="flex-1"><div class="font-semibold text-on-surface">Novo colaborador</div><div class="text-[12px] text-on-surface-variant">Crie o login e a senha para passar à pessoa</div></div>
        <button data-action="close-x" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
      </div>
      <div class="space-y-3 mt-3">
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Nome</label><input id="inv-name" class="${inputCls}"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Usuário (login)</label><input id="inv-user" autocapitalize="none" autocomplete="off" class="${inputCls}"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Senha</label>
          <div class="flex gap-2 mt-1">
            <input id="inv-pass" type="text" autocomplete="off" autocapitalize="none" placeholder="mínimo 6 caracteres" class="${inputCls} !mt-0 mono">
            <button id="inv-gen" class="tap flex-none px-3 rounded-lg bg-surface-container text-primary text-[12px] font-semibold">Gerar</button>
          </div>
        </div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Função</label>
          <div class="flex gap-2 mt-1">
            <button data-inv-role="operador" class="${pickCls(true)}">${icon('engineering', 'text-[18px]')} Operador</button>
            ${currentUser.titular ? `<button data-inv-role="gerente" class="${pickCls(false)}">${icon('shield_person', 'text-[18px]')} Gestor</button>` : ''}
          </div>
          ${currentUser.titular ? '' : `<p class="text-[11px] text-on-surface-variant mt-1">Somente o titular pode criar contas de gestor.</p>`}
        </div>
        ${act.length > 1 ? `<div id="inv-turno-wrap"><label class="mono text-[10px] uppercase text-on-surface-variant">Turno</label>
          <div class="flex gap-2 mt-1">${act.map(x => turnoBtn(x.idx, `${x.idx + 1}º turno`, `${x.inicio}–${x.fim}`)).join('')}${turnoBtn(null, 'Ambos', '')}</div>
        </div>` : ''}
      </div>
      <button data-action="invite-confirm" class="tap w-full mt-4 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px]">Criar acesso</button>
    </div></div>`;
  const inv = window.__inv;
  $('inv-gen').onclick = () => { $('inv-pass').value = suggestPassword(); };
  document.querySelectorAll('[data-inv-role]').forEach(b => b.onclick = () => {
    inv.role = b.dataset.invRole;
    document.querySelectorAll('[data-inv-role]').forEach(x => x.className = pickCls(x.dataset.invRole === inv.role));
    const tw = $('inv-turno-wrap'); if (tw) tw.classList.toggle('hidden', inv.role !== 'operador'); // gestor vê todos os turnos
  });
  document.querySelectorAll('[data-inv-turno]').forEach(b => b.onclick = () => {
    inv.turno = b.dataset.invTurno === '' ? null : +b.dataset.invTurno;
    document.querySelectorAll('[data-inv-turno]').forEach(x => x.className = pickCls((x.dataset.invTurno === '' ? null : +x.dataset.invTurno) === inv.turno) + ' flex-col !gap-0');
  });
}

export async function confirmInvite() {
  const inv = window.__inv;
  const name = $('inv-name').value.trim(), username = $('inv-user').value.trim().toLowerCase(), password = $('inv-pass').value.trim();
  if (!name || !username) { toast('Informe nome e usuário.', 'err'); return; }
  if (password.length < 6) { toast('A senha precisa ter pelo menos 6 caracteres.', 'err'); return; }
  if (inv.role === 'operador' && inv.turno === undefined) { toast('Escolha o turno do operador.', 'err'); return; }
  try {
    await api.inviteMember(name, username, inv.role, password, inv.role === 'operador' ? inv.turno : null);
    await renderEquipe();
    credentialsSheet(name, username, password);
  } catch (e) { toast(e.message || 'Não foi possível criar o acesso.', 'err'); }
}

// login e senha na tela até o gestor fechar — pra anotar/passar à pessoa com calma
function credentialsSheet(name, username, password, title = 'Acesso criado') {
  const line = (label, v) => `<div class="flex items-center justify-between gap-3 py-2">
      <span class="mono text-[10px] uppercase text-on-surface-variant">${label}</span><span class="mono text-[16px] font-bold text-on-surface select-all">${esc(v)}</span></div>`;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40"></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[360px] shadow-2xl p-5">
      <div class="flex flex-col items-center text-center">${icon('check_circle', 'text-conf-tx text-[40px]', true)}
        <div class="font-semibold text-on-surface mt-1">${title} para ${esc(name)}</div>
        <div class="text-[12px] text-on-surface-variant">Passe estes dados para a pessoa entrar no meuPAC.</div></div>
      <div class="bg-surface-container-low rounded-xl px-4 py-1 mt-4 divide-y divide-outline-variant/40">${line('Usuário', username)}${line('Senha', password)}</div>
      <button id="cred-copy" class="tap w-full mt-3 bg-surface-container text-primary rounded-xl py-3 font-semibold text-[14px] flex items-center justify-center gap-1.5">${icon('content_copy', 'text-[18px]')} Copiar login e senha</button>
      <button data-action="close-x" class="tap w-full mt-2 bg-primary text-on-primary rounded-xl py-3 font-semibold text-[14px]">Pronto</button>
    </div></div>`;
  $('cred-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(`meuPAC\nUsuário: ${username}\nSenha: ${password}`); toast('Copiado.'); }
    catch (e) { toast('Não deu pra copiar — anote os dados na tela.', 'err'); }
  };
}

export function editMemberSheet(id) {
  const t = DB.team.find(x => x.id === id); if (!t) return;
  window.__edit = { id: t.id, role: t.role, owned: new Set(t.ownedFormIds || []), turno: t.turnoIdx ?? null };
  renderEditSheet();
}

export function renderEditSheet() {
  const e = window.__edit; const t = DB.team.find(x => x.id === e.id); if (!t) return;
  const roleBtn = (v, label, ic) => `<button data-action="edit-role" data-role="${v}" class="tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold ${e.role === v ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}">${icon(ic, 'text-[18px]')} ${label}</button>`;
  const activePacs = DB.pacs.filter(p => pacActive(p) && DB.forms.some(f => f.pacId === p.id));
  const pacBlocks = activePacs.map(p => {
    const fs = DB.forms.filter(f => f.pacId === p.id);
    return `<div class="mt-3">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-6 h-6 rounded-md bg-surface-container flex items-center justify-center flex-none">${icon(p.icon, 'text-primary text-[15px]', true)}</span>
        <span class="mono text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold truncate">${p.code} · ${esc(p.name)}</span>
      </div>
      <div class="divide-y divide-outline-variant/30 pl-1">
        ${fs.map(f => { const on = e.owned.has(f.id);
          const linked = (f.operatorIds || []).map(id => DB.team.find(m => m.id === id)).filter(Boolean);
          return `<button data-action="edit-form-toggle" data-form="${f.id}" class="tap w-full flex items-center gap-3 py-2.5 px-1 text-left">
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-medium text-on-surface truncate">${esc(f.title)}</div>
              <div class="mono text-[10px] text-on-surface-variant truncate">${plCode(f)} · ${esc(dueText(f))}</div>
              <div class="linked-avatars flex items-center gap-1 mt-1.5 ${linked.length ? '' : 'hidden'}">${linked.map(u => avatarChip(u)).join('')}</div>
            </div>
            <span class="material-symbols-outlined ${on ? 'ms-fill text-secondary' : 'text-outline-variant'} text-[24px]">${on ? 'check_circle' : 'radio_button_unchecked'}</span>
          </button>`; }).join('')}
      </div>
    </div>`;
  }).join('');
  // turno do operador: define quais horários ele vê (início do seu turno, a cada 2h dentro do seu turno…)
  const act = activeTurnos(unitTurnos());
  const turnoBtn = (v, label, sub) => { const on = e.turno === v; return `<button data-edit-turno="${v === null ? '' : v}" class="tap flex-1 flex flex-col items-center py-2 rounded-lg text-[12px] font-semibold ${on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}">${label}${sub ? `<span class="mono text-[10px] font-normal opacity-80">${sub}</span>` : ''}</button>`; };
  const turnoSection = act.length < 2 ? '' : `<p class="mono text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 mb-2">Turno</p>
      <div class="flex gap-2">${act.map(x => turnoBtn(x.idx, `${x.idx + 1}º turno`, `${x.inicio}–${x.fim}`)).join('')}${turnoBtn(null, 'Ambos', '')}</div>
      <p class="text-[11px] text-on-surface-variant mt-1">Ele vê só os horários do seu turno.</p>`;
  const formsSection = pacBlocks || `<div class="mt-3 flex items-center gap-2 bg-surface-container rounded-lg p-3 text-on-surface-variant text-[12px]">${icon('info', 'text-[18px] flex-none')} Nenhum PAC ativo com planilhas definidas ainda.</div>`;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[400px] max-h-[85dvh] overflow-y-auto scroll-area shadow-2xl p-4">
      <div class="flex items-center gap-3 pb-4 border-b border-outline-variant/40">
        <span class="w-11 h-11 rounded-full flex items-center justify-center font-mono text-[13px] font-bold" style="background:${t.color || '#dfe9fb'};color:${t.ink || '#0f2642'}">${t.initials || '·'}</span>
        <div class="flex-1 min-w-0"><div class="font-semibold text-on-surface truncate">${esc(t.name)}</div><div class="text-[12px] text-on-surface-variant">Editar acessos e permissões</div></div>
        <button data-action="close-x" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
      </div>
      <p class="mono text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 mb-2">Função</p>
      <div class="flex gap-2">${roleBtn('operador', 'Operador', 'engineering')}${currentUser.titular ? roleBtn('gerente', 'Gestor', 'shield_person') : ''}</div>
      ${currentUser.titular ? '' : `<p class="mono text-[10px] text-on-surface-variant mt-1">Somente o titular pode promover alguém a gestor.</p>`}
      ${e.role === 'operador'
        ? `<div class="mt-4 flex items-start gap-2 bg-surface-container rounded-lg p-3 text-on-surface-variant text-[12px]">${icon('engineering', 'text-primary text-[18px] flex-none', true)}<span>O operador preenche e assina digitalmente as planilhas do seu turno. Planilha sem ninguém marcado fica liberada para todos os operadores; marque abaixo para restringir uma planilha a quem você escolher. Não acessa o painel de gestão, o histórico da fábrica nem assina planilhas de outros.</span></div>
           ${turnoSection}
           <p class="mono text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 mb-1">Restringir planilhas · <span id="owned-count">${e.owned.size}</span></p>${formsSection}`
        : `<div class="mt-4 flex items-start gap-2 bg-inverse-primary rounded-lg p-3 text-primary text-[12px]">${icon('verified_user', 'text-[18px] flex-none', true)}<span>O gestor valida e assina as planilhas, acompanha o painel e o histórico de toda a unidade e gerencia os operadores. Não preenche planilhas — isso é do operador.</span></div>`}
      <button data-action="save-member" class="tap w-full mt-4 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px]">Salvar acessos</button>
    </div></div>`;
  document.querySelectorAll('[data-edit-turno]').forEach(b => b.onclick = () => {
    const sc = b.closest('.overflow-y-auto'), y = sc ? sc.scrollTop : 0;
    e.turno = b.dataset.editTurno === '' ? null : +b.dataset.editTurno; renderEditSheet();
    const sc2 = document.querySelector('#modal-root .overflow-y-auto'); if (sc2) sc2.scrollTop = y;
  });
}

// alterna o acesso sem re-renderizar o popup inteiro: só troca o ícone de check
// e o avatar da própria pessoa embaixo da planilha, pra não "piscar" a tela.
export function toggleFormAccess(formId) {
  const e = window.__edit; if (!e) return;
  const btn = document.querySelector(`[data-action="edit-form-toggle"][data-form="${formId}"]`);
  const nowOn = !e.owned.has(formId);
  nowOn ? e.owned.add(formId) : e.owned.delete(formId);
  if (!btn) { renderEditSheet(); return; }

  const chk = btn.querySelector('.material-symbols-outlined');
  if (chk) {
    chk.textContent = nowOn ? 'check_circle' : 'radio_button_unchecked';
    chk.className = `material-symbols-outlined ${nowOn ? 'ms-fill text-secondary' : 'text-outline-variant'} text-[24px]`;
  }

  const t = DB.team.find(x => x.id === e.id);
  const row = btn.querySelector('.linked-avatars');
  if (row && t) {
    const existing = row.querySelector(`[data-uid="${t.id}"]`);
    if (nowOn && !existing) row.insertAdjacentHTML('beforeend', avatarChip(t));
    else if (!nowOn && existing) existing.remove();
    row.classList.toggle('hidden', !row.children.length);
  }

  const counter = document.getElementById('owned-count');
  if (counter) counter.textContent = e.owned.size;
}

export async function saveMember() {
  const e = window.__edit;
  try {
    await api.updateMember(e.id, e.role, [...e.owned], e.turno);
    await api.refreshState();
    closeModal();
    await renderEquipe();
    toast('Acessos atualizados.');
  } catch (err) { toast(err.message || 'Não foi possível salvar os acessos.', 'err'); }
}

// o gestor digita a nova senha (ou gera uma) — mesma ideia da criação do acesso
export function confirmResetPassword(id) {
  const t = DB.team.find(x => x.id === id); if (!t) return;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[380px] shadow-2xl p-5">
      <div class="flex items-center gap-2 mb-1">${icon('key', 'text-primary text-[24px]', true)}<div class="font-semibold text-on-surface text-[16px]">Nova senha de ${esc(t.name)}</div></div>
      <p class="text-[13px] text-on-surface-variant mb-3">A senha atual deixa de funcionar.</p>
      <label class="mono text-[10px] uppercase text-on-surface-variant">Nova senha</label>
      <div class="flex gap-2 mt-1">
        <input id="rst-pass" type="text" autocomplete="off" autocapitalize="none" placeholder="mínimo 6 caracteres" class="${inputCls} !mt-0 mono">
        <button id="rst-gen" class="tap flex-none px-3 rounded-lg bg-surface-container text-primary text-[12px] font-semibold">Gerar</button>
      </div>
      <div class="flex gap-2 mt-4">
        <button data-action="close-x" class="tap flex-1 bg-surface-container text-on-surface rounded-xl py-3 font-semibold text-[14px]">Cancelar</button>
        <button data-action="reset-pass-confirm" data-id="${t.id}" class="tap flex-1 bg-primary text-on-primary rounded-xl py-3 font-semibold text-[14px]">Salvar senha</button>
      </div>
    </div></div>`;
  $('rst-gen').onclick = () => { $('rst-pass').value = suggestPassword(); };
}

export async function resetMemberPassword(id) {
  const t = DB.team.find(x => x.id === id); if (!t) return;
  const password = $('rst-pass').value.trim();
  if (password.length < 6) { toast('A senha precisa ter pelo menos 6 caracteres.', 'err'); return; }
  try {
    await api.resetMemberPassword(id, password);
    credentialsSheet(t.name, t.username, password, 'Senha redefinida');
  } catch (e) { toast(e.message || 'Não foi possível redefinir a senha.', 'err'); }
}

export function confirmDelete(id) {
  const t = DB.team.find(x => x.id === id); if (!t) return;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[380px] shadow-2xl p-5">
      <div class="flex items-center gap-2 mb-2">${icon('person_remove', 'text-error text-[24px]', true)}<div class="font-semibold text-on-surface text-[16px]">Remover ${esc(t.name)}?</div></div>
      <p class="text-[13px] text-on-surface-variant mb-4">O colaborador perde o acesso ao sistema. Os registros já assinados permanecem intactos na trilha de auditoria.</p>
      <div class="flex gap-2">
        <button data-action="close-x" class="tap flex-1 bg-surface-container text-on-surface rounded-xl py-3 font-semibold text-[14px]">Cancelar</button>
        <button data-action="del-confirm" data-id="${t.id}" class="tap flex-1 bg-error text-on-error rounded-xl py-3 font-semibold text-[14px]">Excluir</button>
      </div>
    </div></div>`;
}

export async function deleteMember(id) {
  try { await api.deleteMember(id); closeModal(); await renderEquipe(); toast('Colaborador removido.'); }
  catch (e) { toast(e.message || 'Não foi possível remover.', 'err'); }
}

// ---- turnos do expediente --------------------------------------------------------
// Ficam aqui (e não em Dados da unidade) porque andam junto com a escala: quem monta
// a equipe define os horários dos turnos e designa cada operador a um deles.
function turnosCard(team) {
  if (!turnosDefinidos(unitTurnos())) {
    return `<div class="bg-pend-bg rounded-xl p-3.5 flex items-center gap-3">
      ${icon('schedule', 'text-pend-tx text-[22px] flex-none', true)}
      <div class="flex-1 min-w-0"><div class="text-[13px] font-semibold text-pend-tx">Horário do expediente não definido</div>
      <div class="text-[12px] text-pend-tx opacity-90">Usado em “a cada X horas” e “início/fim do turno”.</div></div>
      <button data-action="edit-turnos" class="tap flex-none bg-primary text-on-primary text-[12px] font-semibold px-3 py-2 rounded-lg">Definir</button>
    </div>`;
  }
  const act = activeTurnos(unitTurnos());
  const ops = team.filter(t => t.role === 'operador');
  const count = idx => ops.filter(t => t.turnoIdx === idx).length;
  const row = x => `<div class="flex items-center justify-between py-1.5">
      <span class="text-[13px] font-semibold text-on-surface">${act.length > 1 ? `${x.idx + 1}º turno` : 'Expediente'} <span class="mono font-normal text-on-surface-variant">${x.inicio}–${x.fim}</span></span>
      ${act.length > 1 ? `<span class="text-[11px] text-on-surface-variant">${count(x.idx)} operador${count(x.idx) !== 1 ? 'es' : ''}</span>` : ''}
    </div>`;
  return `<div class="bg-surface-container-lowest rounded-xl p-3.5">
    <div class="flex items-center justify-between mb-1">
      <div class="flex items-center gap-2">${icon('schedule', 'text-secondary text-[18px]', true)}<span class="mono text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Turnos</span></div>
      <button data-action="edit-turnos" class="tap text-[12px] font-semibold text-primary px-2 py-1 rounded-lg">Editar</button>
    </div>
    ${act.map(row).join('')}
  </div>`;
}

function turnoRow(i, t, fixed) {
  const inp = (id, v) => `<input id="${id}" type="time" step="300" value="${esc(v)}" class="bg-surface-container-low rounded-lg px-2 py-2 mono text-[14px] text-on-surface border border-transparent focus:border-primary">`;
  const on = fixed || t.ativo !== false;
  // nome do turno numa linha, horários na de baixo — igual nos dois turnos, pra alinhar no celular
  return `<div class="${i ? 'mt-3' : ''}">
    <div class="flex items-center gap-2 h-[26px]">
      <span class="text-[13px] font-semibold text-on-surface">${i + 1}º turno</span>
      ${fixed ? '' : `<span id="uni-t${i}-on" class="toggle ${on ? 'on' : ''} flex-none cursor-pointer ml-auto"></span>`}
    </div>
    <div id="uni-t${i}-times" class="flex items-center gap-2 mt-1 ${on ? '' : 'opacity-40 pointer-events-none'}">${inp(`uni-t${i}-ini`, t.inicio)}<span class="text-[12px] text-on-surface-variant">às</span>${inp(`uni-t${i}-fim`, t.fim)}</div>
  </div>`;
}

export function turnosSheet() {
  const u = DB.unidade || {};
  // unidade antiga sem nada salvo mostra o padrão; conta nova vem com o 1º turno vazio e o 2º desligado
  const turnos = [0, 1].map(i => u.turnos ? { inicio: '', fim: '', ativo: i === 0, ...(u.turnos[i] || {}) } : DEFAULT_TURNOS[i]);
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[380px] shadow-2xl p-4">
      <div class="flex items-center gap-3 pb-3 border-b border-outline-variant/40">
        <div class="flex-1"><div class="font-semibold text-on-surface">Turnos</div><div class="text-[12px] text-on-surface-variant">Horários de "início/fim do turno" e padrão das planilhas "a cada X horas"</div></div>
        <button data-action="close-x" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
      </div>
      <div class="pt-3">${turnoRow(0, turnos[0], true)}${turnoRow(1, turnos[1], false)}</div>
      <button data-action="save-turnos" class="tap w-full mt-4 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px]">Salvar turnos</button>
    </div></div>`;
  const tg = $('uni-t1-on'); if (tg) tg.onclick = () => {
    tg.classList.toggle('on'); const on = tg.classList.contains('on');
    $('uni-t1-times').classList.toggle('opacity-40', !on); $('uni-t1-times').classList.toggle('pointer-events-none', !on);
  };
}

export async function saveTurnos() {
  const turnos = [
    { inicio: $('uni-t0-ini').value, fim: $('uni-t0-fim').value, ativo: true },
    { inicio: $('uni-t1-ini').value, fim: $('uni-t1-fim').value, ativo: $('uni-t1-on').classList.contains('on') },
  ];
  try {
    await api.saveTurnos(turnos); await api.refreshState(); closeModal();
    // no editor de planilha não re-renderiza a tela (perderia o que já foi digitado)
    if (screen === 'ge_form_editor') turnosChanged(); else rerender();
    toast('Turnos salvos.');
  }
  catch (e) { toast(e.message || 'Não foi possível salvar os turnos.', 'err'); }
}

// confere a cadeia de hashes inteira no servidor (routes/audit.js)
export async function verifyAudit() {
  try {
    const r = await api.verifyAudit();
    if (r.ok) toast(`Trilha íntegra: ${r.checked} registro${r.checked !== 1 ? 's' : ''} conferido${r.checked !== 1 ? 's' : ''}.`);
    else toast(`Atenção: ${r.problems.length} registro${r.problems.length !== 1 ? 's' : ''} com hash que não confere.`, 'err');
  } catch (e) { toast(e.message || 'Não foi possível verificar.', 'err'); }
}
