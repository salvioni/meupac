import { $ } from './helpers.js';
import { currentUser, setScreenParams, screen, params } from './state.js';
import * as api from './api.js';
import { renderLogin } from './screens/login.js';
import { renderOpPac, renderPreencher, renderDetalhe, submitFill, exportRecordPdf, setOpFilter } from './screens/operador.js';
import { renderOpHist, renderGeHist, exportSheet, runExport } from './screens/historico.js';
import { renderPainel, sign, signAll } from './screens/painel.js';
import { renderForms, renderPacForms, togglePacActive, toggleFormActive } from './screens/pacs.js';
import { renderFormEditor, saveFormEditor, syncEditorParams, renderEditorTimes, openTimePicker, syncWhen, renderWhen, confirmDeleteForm, deleteFormConfirmed, openAddParam } from './screens/formEditor.js';
import { renderEquipe, inviteSheet, confirmInvite, editMemberSheet, renderEditSheet, toggleFormAccess, saveMember, confirmResetPassword, resetMemberPassword, confirmDelete, deleteMember, turnosSheet, saveTurnos, verifyAudit } from './screens/equipe.js';
import { profileMenu, changePasswordSheet, saveNewPassword, unidadeSheet, saveUnidade } from './screens/perfil.js';
import { toast } from './helpers.js';
import { tourTick, startTour } from './tour.js';

// a tela atual fica gravada na URL (?screen=...&...) pra sobreviver a um F5 —
// sem isso, todo reload cai sempre no painel/lista padrão, perdendo onde a
// pessoa estava (equipe, editor de planilha etc.).
function pushUrl(s, p, replace) {
  try {
    const qs = new URLSearchParams({ screen: s, ...p });
    const url = '/app?' + qs.toString();
    (replace ? history.replaceState : history.pushState).call(history, { s, p }, '', url);
  } catch (e) { /* history API indisponível — navegação continua funcionando via JS */ }
}

export function navigate(s, p = {}, replace = false) {
  setScreenParams(s, p);
  render();
  window.scrollTo(0, 0);
  const sc = $('screen-scroll'); if (sc) sc.scrollTop = 0;
  if (screen !== s) return; // render redirecionou (tela não permitida) e já gravou a URL certa
  pushUrl(s, p, replace);
}

window.addEventListener('popstate', (e) => {
  if (!currentUser) return;
  if (e.state && e.state.s) { setScreenParams(e.state.s, e.state.p || {}); render(); }
});

// re-render mantendo a rolagem e sem a animação de entrada (atualizações in-place)
export function rerender(fn) {
  const sc = $('screen-scroll'); const y = sc ? sc.scrollTop : 0;
  window.__noAnim = true; (fn || render)(); window.__noAnim = false;
  const sc2 = $('screen-scroll'); if (sc2) sc2.scrollTop = y;
}

export function closeModal() { $('modal-root').innerHTML = ''; }

export async function afterLogin(user) {
  try {
    await api.refreshState();
    navigate(user.role === 'operador' ? 'op_pac' : 'ge_painel');
  } catch (e) {
    toast(e.message || 'Não foi possível carregar os dados.', 'err');
  }
}

export function logout() {
  closeModal();
  api.logout();
  navigate('login');
}

export function render() {
  renderScreen();
  tourTick(); // tutorial do gestor: destaca o próximo passo na tela que acabou de abrir
}

function renderScreen() {
  const frame = $('frame');
  if (!currentUser) { if (frame) frame.classList.add('web'); renderLogin(); return; }
  if (frame) frame.classList.remove('web');
  // telas de gestor (ge_*) não abrem pra operador, nem digitando o endereço na mão;
  // e as de preencher não abrem pra gestor. O servidor já recusa as ações — isso
  // evita mostrar botões (ex.: editar turnos) que a pessoa não pode usar.
  const isOp = currentUser.role === 'operador';
  if ((isOp && screen.startsWith('ge_')) || (!isOp && (screen === 'op_pac' || screen === 'op_fill' || screen === 'op_hist'))) {
    navigate(isOp ? 'op_pac' : 'ge_painel', {}, true); return;
  }
  switch (screen) {
    case 'op_pac': renderOpPac(); break;
    case 'op_fill': renderPreencher(); break;
    case 'op_detalhe': renderDetalhe(); break;
    case 'op_hist': renderOpHist(); break;
    case 'ge_painel': renderPainel(); break;
    case 'ge_hist': renderGeHist(); break;
    case 'ge_forms': renderForms(); break;
    case 'ge_pac_forms': renderPacForms(); break;
    case 'ge_form_editor': renderFormEditor(); break;
    case 'ge_equipe': renderEquipe(); break;
    default: currentUser.role === 'operador' ? renderOpPac() : renderPainel();
  }
}

export function initEventDelegation() {
  document.addEventListener('click', (e) => {
    const closeEl = e.target.closest('[data-close-modal]');
    if (closeEl && e.target === closeEl) { closeModal(); return; }
    const el = e.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action;
    switch (a) {
      case 'nav': if (el.dataset.nav === 'op_pac') setOpFilter('afazer'); navigate(el.dataset.nav); break;
      case 'op-filter': setOpFilter(el.dataset.filter); renderOpPac(); break;
      case 'profile': profileMenu(el); break;
      case 'logout': logout(); break;
      case 'change-pass': closeModal(); changePasswordSheet(); break;
      case 'save-pass': saveNewPassword(); break;
      case 'unidade': closeModal(); unidadeSheet(); break;
      case 'save-unidade': saveUnidade(); break;
      case 'edit-turnos': turnosSheet(); break;
      case 'save-turnos': saveTurnos(); break;
      case 'open-form': navigate('op_fill', el.dataset.slot ? { form: el.dataset.form, slot: el.dataset.slot } : { form: el.dataset.form }); break;
      case 'submit-fill': submitFill(); break;
      case 'mock-photo': { const t = $('photo-tag'); if (t) { t.classList.remove('hidden'); t.classList.add('flex'); } toast('Foto anexada ao registro.'); break; }
      case 'focus-note': { const n = $('fill-note'); if (n) n.focus(); break; }
      case 'open-sub': navigate('op_detalhe', { sub: el.dataset.sub, from: screen === 'op_hist' ? 'hist' : screen }); break;
      case 'sign': sign(el.dataset.sub); break;
      case 'sign-all': signAll(); break;
      case 'open-pac': navigate('ge_pac_forms', { pac: el.dataset.pac }); break;
      case 'toggle-pac-active': togglePacActive(el.dataset.pac); break;
      case 'toggle-form-active': toggleFormActive(el.dataset.form); break;
      case 'new-form': navigate('ge_form_editor', { pac: el.dataset.pac }); break;
      case 'config-form': navigate('ge_form_editor', { form: el.dataset.form }); break;
      case 'add-param': syncEditorParams(); openAddParam(); break;
      case 'add-time': openTimePicker(-1); break;
      case 'edit-time': openTimePicker(+el.dataset.idx); break;
      case 'del-time': window.__editorTimes.splice(+el.dataset.idx, 1); renderEditorTimes(); break;
      case 'when-type': syncWhen(); window.__when.type = el.dataset.type; renderWhen(); break;
      case 'when-moment': { syncWhen(); const s = window.__when.moments; const mm = el.dataset.m; s.has(mm) ? s.delete(mm) : s.add(mm); renderWhen(); break; }
      case 'save-form': saveFormEditor(); break;
      case 'delete-form': confirmDeleteForm(el.dataset.form); break;
      case 'del-form-confirm': deleteFormConfirmed(el.dataset.form); break;
      case 'export-pdf': exportRecordPdf(el.dataset.sub); break;
      case 'open-export': exportSheet(); break;
      case 'run-export': runExport(closeModal); break;
      case 'invite': closeModal(); inviteSheet(); break;
      case 'invite-confirm': confirmInvite(); break;
      case 'edit-member': editMemberSheet(el.dataset.id); break;
      case 'edit-role': window.__edit.role = el.dataset.role; renderEditSheet(); break;
      case 'edit-form-toggle': toggleFormAccess(el.dataset.form); break;
      case 'save-member': saveMember(); break;
      case 'reset-pass-member': confirmResetPassword(el.dataset.id); break;
      case 'reset-pass-confirm': resetMemberPassword(el.dataset.id); break;
      case 'del-member': confirmDelete(el.dataset.id); break;
      case 'del-confirm': deleteMember(el.dataset.id); break;
      case 'close-x': closeModal(); break;
      case 'tour-start': startTour(); break;
      case 'verify-audit': verifyAudit(); break;
    }
  });
}
