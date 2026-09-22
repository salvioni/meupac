import { $ } from './helpers.js';
import { currentUser, setScreenParams, screen, params, getForm, getPac } from './state.js';
import * as api from './api.js';
import { renderLogin } from './screens/login.js';
import { renderOpPac, renderPreencher, renderDetalhe, submitFill, exportRecordPdf, setOpFilter } from './screens/operador.js';
import { renderOpHist, renderGeHist, exportSheet, runExport } from './screens/historico.js';
import { renderPainel, sign, signAll } from './screens/painel.js';
import { renderForms, renderPacForms, togglePacActive } from './screens/pacs.js';
import { renderFormEditor, saveFormEditor, syncEditorParams, renderEditorParams, syncEditorTimes, renderEditorTimes, syncWhen, renderWhen } from './screens/formEditor.js';
import { renderEquipe, inviteSheet, confirmInvite, editMemberSheet, renderEditSheet, saveMember, confirmDelete, deleteMember } from './screens/equipe.js';
import { profileMenu, changePasswordSheet, saveNewPassword, unidadeSheet, saveUnidade } from './screens/perfil.js';
import { toast } from './helpers.js';

export function navigate(s, p = {}) {
  setScreenParams(s, p);
  render();
  window.scrollTo(0, 0);
  const sc = $('screen-scroll'); if (sc) sc.scrollTop = 0;
}

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
  if (!currentUser) { renderLogin(); return; }
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
      case 'profile': profileMenu(); break;
      case 'logout': logout(); break;
      case 'change-pass': closeModal(); changePasswordSheet(); break;
      case 'save-pass': saveNewPassword(); break;
      case 'unidade': closeModal(); unidadeSheet(); break;
      case 'save-unidade': saveUnidade(); break;
      case 'open-form': navigate('op_fill', { form: el.dataset.form }); break;
      case 'open-form-preview': { const f = getForm(el.dataset.form); toast('Cobrança enviada ao operador de ' + getPac(f.pacId).name + '.', 'info'); break; }
      case 'submit-fill': submitFill(); break;
      case 'mock-photo': { const t = $('photo-tag'); if (t) { t.classList.remove('hidden'); t.classList.add('flex'); } toast('Foto anexada ao registro.'); break; }
      case 'focus-note': { const n = $('fill-note'); if (n) n.focus(); break; }
      case 'open-sub': navigate('op_detalhe', { sub: el.dataset.sub, from: screen === 'op_hist' ? 'hist' : screen }); break;
      case 'sign': sign(el.dataset.sub); break;
      case 'sign-all': signAll(); break;
      case 'open-pac': navigate('ge_pac_forms', { pac: el.dataset.pac }); break;
      case 'toggle-pac-active': togglePacActive(el.dataset.pac); break;
      case 'new-form': navigate('ge_form_editor', { pac: el.dataset.pac }); break;
      case 'config-form': navigate('ge_form_editor', { form: el.dataset.form }); break;
      case 'add-param': syncEditorParams(); window.__editorParams.push({ id: 'np' + Date.now(), type: 'numeric', name: '', unit: '', min: 0, max: 0, step: 0.1, seed: 0 }); renderEditorParams(); break;
      case 'add-time': syncEditorTimes(); window.__editorTimes.push(''); renderEditorTimes(); break;
      case 'del-time': syncEditorTimes(); window.__editorTimes.splice(+el.dataset.idx, 1); renderEditorTimes(); break;
      case 'when-type': syncWhen(); window.__when.type = el.dataset.type; renderWhen(); break;
      case 'when-moment': { const s = window.__when.moments; const mm = el.dataset.m; s.has(mm) ? s.delete(mm) : s.add(mm); renderWhen(); break; }
      case 'save-form': saveFormEditor(); break;
      case 'export-pdf': exportRecordPdf(el.dataset.sub); break;
      case 'open-export': exportSheet(); break;
      case 'run-export': runExport(closeModal); break;
      case 'invite': closeModal(); inviteSheet(); break;
      case 'invite-confirm': confirmInvite(); break;
      case 'edit-member': editMemberSheet(el.dataset.id); break;
      case 'edit-role': window.__edit.role = el.dataset.role; renderEditSheet(); break;
      case 'edit-form-toggle': { const id = el.dataset.form; const s = window.__edit.owned; s.has(id) ? s.delete(id) : s.add(id); renderEditSheet(); break; }
      case 'save-member': saveMember(); break;
      case 'del-member': confirmDelete(el.dataset.id); break;
      case 'del-confirm': deleteMember(el.dataset.id); break;
      case 'close-x': closeModal(); break;
    }
  });
}
