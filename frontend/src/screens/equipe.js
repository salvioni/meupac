import { $, esc, icon, toast } from '../helpers.js';
import { DB, currentUser, isTitular, getPac, pacActive, dueText, plCode, unitTurnos } from '../state.js';
import { activeTurnos, DEFAULT_TURNOS } from '../schedule.js';

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
        ${isOp ? `<div class="flex items-center gap-1 text-[11px] text-on-surface-variant mt-0.5"><span class="truncate">${turnoName(t) ? `${turnoName(t)} · ` : ''}${t.ownedFormIds.length} planilha${t.ownedFormIds.length !== 1 ? 's' : ''} autorizada${t.ownedFormIds.length !== 1 ? 's' : ''}</span></div>` : ''}
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
    <div class="bg-surface-container rounded-xl p-4 flex gap-2">${icon('shield', 'text-on-surface-variant flex-none', true)}<p class="text-[12px] text-on-surface-variant">Trilha de auditoria com cadeia de hashes: qualquer alteração retroativa de um registro assinado é detectável — conferível em Auditoria.</p></div>
  </div>`;
  app().innerHTML = shell(inner, GE_NAV, 'ge_equipe', profileTrigger());
}

export function inviteSheet() {
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[380px] shadow-2xl p-4">
      <div class="flex items-center gap-3 pb-3 border-b border-outline-variant/40">
        <div class="flex-1"><div class="font-semibold text-on-surface">Convidar colaborador</div><div class="text-[12px] text-on-surface-variant">Cria um acesso com senha temporária</div></div>
        <button data-action="close-x" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
      </div>
      <div class="space-y-3 mt-3">
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Nome</label><input id="inv-name" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Usuário (login)</label><input id="inv-user" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
        <div class="flex gap-2">
          <button data-inv-role="operador" class="inv-role-btn tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold bg-primary text-on-primary">${icon('engineering', 'text-[18px]')} Operador</button>
          ${currentUser.titular ? `<button data-inv-role="gerente" class="inv-role-btn tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold bg-surface-container text-on-surface-variant">${icon('shield_person', 'text-[18px]')} Gestor</button>` : ''}
        </div>
        ${currentUser.titular ? '' : `<p class="text-[11px] text-on-surface-variant">Somente o titular pode criar contas de gestor.</p>`}
      </div>
      <button data-action="invite-confirm" class="tap w-full mt-4 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px]">Criar acesso</button>
    </div></div>`;
  window.__invRole = 'operador';
  document.querySelectorAll('.inv-role-btn').forEach(b => b.onclick = () => { window.__invRole = b.dataset.invRole; document.querySelectorAll('.inv-role-btn').forEach(x => x.className = 'inv-role-btn tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold ' + (x.dataset.invRole === window.__invRole ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant')); });
}

export async function confirmInvite() {
  const name = $('inv-name').value.trim(), username = $('inv-user').value.trim();
  if (!name || !username) { toast('Informe nome e usuário.', 'err'); return; }
  try {
    const { tempPassword } = await api.inviteMember(name, username, window.__invRole);
    closeModal();
    toast(`Acesso criado. Senha temporária: ${tempPassword}`, 'info');
    renderEquipe();
  } catch (e) { toast(e.message || 'Não foi possível criar o acesso.', 'err'); }
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
        ? `<div class="mt-4 flex items-start gap-2 bg-surface-container rounded-lg p-3 text-on-surface-variant text-[12px]">${icon('engineering', 'text-primary text-[18px] flex-none', true)}<span>O operador preenche e assina digitalmente, no seu turno, apenas as planilhas autorizadas abaixo. Não acessa o painel de gestão, o histórico da fábrica nem assina planilhas de outros.</span></div>
           ${turnoSection}
           <p class="mono text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 mb-1">Planilhas Permitidas · <span id="owned-count">${e.owned.size}</span></p>${formsSection}`
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

export function confirmResetPassword(id) {
  const t = DB.team.find(x => x.id === id); if (!t) return;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[380px] shadow-2xl p-5">
      <div class="flex items-center gap-2 mb-2">${icon('key', 'text-primary text-[24px]', true)}<div class="font-semibold text-on-surface text-[16px]">Redefinir senha de ${esc(t.name)}?</div></div>
      <p class="text-[13px] text-on-surface-variant mb-4">A senha atual deixa de funcionar e uma nova senha temporária é gerada na hora — repasse para ${esc(t.name.split(' ')[0])}.</p>
      <div class="flex gap-2">
        <button data-action="close-x" class="tap flex-1 bg-surface-container text-on-surface rounded-xl py-3 font-semibold text-[14px]">Cancelar</button>
        <button data-action="reset-pass-confirm" data-id="${t.id}" class="tap flex-1 bg-primary text-on-primary rounded-xl py-3 font-semibold text-[14px]">Redefinir</button>
      </div>
    </div></div>`;
}

export async function resetMemberPassword(id) {
  try {
    const { tempPassword } = await api.resetMemberPassword(id);
    closeModal();
    toast(`Senha redefinida. Nova senha temporária: ${tempPassword}`, 'info');
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
  const act = activeTurnos(unitTurnos());
  const ops = team.filter(t => t.role === 'operador');
  const count = idx => ops.filter(t => t.turnoIdx === idx).length;
  const ambos = act.length > 1 ? ops.filter(t => !act.some(x => x.idx === t.turnoIdx)).length : 0;
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
    ${ambos ? `<div class="text-[11px] text-on-surface-variant pt-1">${ambos} operador${ambos !== 1 ? 'es' : ''} em ambos os turnos</div>` : ''}
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
  const turnos = [0, 1].map(i => ({ ...DEFAULT_TURNOS[i], ...((u.turnos || [])[i] || {}) }));
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
  try { await api.saveTurnos(turnos); await api.refreshState(); closeModal(); rerender(); toast('Turnos salvos.'); }
  catch (e) { toast(e.message || 'Não foi possível salvar os turnos.', 'err'); }
}
