import { $, esc, icon, toast } from '../helpers.js';
import { cnpjField, municipioField, wireBrFields, readBrFields } from '../brFields.js';
import { currentUser, getUnidade } from '../state.js';
import * as api from '../api.js';
import { closeModal } from '../router.js';

export function profileMenu(triggerEl) {
  const mr = $('modal-root');
  if (mr.querySelector('#profile-pop')) { mr.innerHTML = ''; return; }
  mr.innerHTML = `<div class="fixed inset-0 z-50" data-close-modal>
    <div id="profile-pop" class="fade-in absolute w-64 max-w-[calc(100vw-24px)] bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/50 overflow-hidden">
      <div class="flex items-center gap-3 p-4 border-b border-outline-variant/40">
        <span class="w-11 h-11 rounded-full flex items-center justify-center font-mono text-[14px] font-bold" style="background:${currentUser.color};color:${currentUser.ink}">${currentUser.initials}</span>
        <div class="min-w-0"><div class="font-semibold text-on-surface truncate">${esc(currentUser.name)}</div><div class="text-[12px] text-on-surface-variant truncate">${currentUser.titular ? 'Admin' : currentUser.role === 'gerente' ? 'Gestor' : 'Operador'}</div></div>
      </div>
      ${currentUser.titular ? `<button data-action="unidade" class="tap w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container">${icon('domain', 'text-on-surface-variant text-[20px]')}<span class="text-[14px] text-on-surface">Dados da unidade</span></button>` : ''}
      <button data-action="change-pass" class="tap w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container">${icon('key', 'text-on-surface-variant text-[20px]')}<span class="text-[14px] text-on-surface">Alterar senha</span></button>
      <button data-action="logout" class="tap w-full flex items-center gap-3 px-4 py-3 text-left text-error border-t border-outline-variant/40 hover:bg-surface-container">${icon('logout', 'text-error text-[20px]')}<span class="text-[14px] font-semibold">Sair da conta</span></button>
    </div></div>`;

  // posiciona ancorado no próprio botão que abriu o menu, em vez de uma fórmula fixa de
  // viewport — essa fórmula só valia quando o app inteiro ficava numa moldura de celular
  // centralizada; num layout responsivo (sidebar no desktop) ela cai em qualquer lugar.
  // ancora pela direita (alinhado à borda direita do botão) em vez de calcular `left`
  // a partir de offsetWidth: o Tailwind do CDN gera as classes de forma assíncrona,
  // então no instante da medição o `w-64` ainda não existe e a largura vem errada
  // (quase a tela toda), jogando o popup pra esquerda.
  const pop = $('profile-pop');
  if (triggerEl && pop) {
    const r = triggerEl.getBoundingClientRect();
    const margin = 12;
    pop.style.width = 'min(256px, calc(100vw - 24px))';
    pop.style.right = Math.max(margin, window.innerWidth - r.right) + 'px';
    pop.style.top = (r.bottom + 8) + 'px';
  } else if (pop) {
    pop.style.top = '56px'; pop.style.right = '12px';
  }
}

export function changePasswordSheet() {
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[380px] shadow-2xl p-4">
      <div class="flex items-center gap-3 pb-3 border-b border-outline-variant/40">
        <div class="flex-1"><div class="font-semibold text-on-surface">Alterar senha</div></div>
        <button data-action="close-x" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
      </div>
      <div id="pass-err" class="hidden bg-nc-bg text-nc-tx text-[13px] font-medium rounded-lg px-3 py-2.5 mt-3"></div>
      <div class="space-y-3 mt-3">
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Senha atual</label><input id="pass-current" type="password" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
        <div><label class="mono text-[10px] uppercase text-on-surface-variant">Nova senha</label><input id="pass-new" type="password" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] border border-transparent focus:border-primary"></div>
      </div>
      <button data-action="save-pass" class="tap w-full mt-4 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px]">Salvar nova senha</button>
    </div></div>`;
}

export async function saveNewPassword() {
  const cur = $('pass-current').value, next = $('pass-new').value;
  const err = $('pass-err');
  try {
    await api.changePassword(cur, next);
    closeModal(); toast('Senha alterada.');
  } catch (e) { err.textContent = e.message || 'Não foi possível alterar a senha.'; err.classList.remove('hidden'); }
}

// fusos do Brasil (um por diferença de horário); se a unidade tiver outro salvo
// (ex.: detectado no cadastro, como America/Cuiaba), ele aparece também
const BR_TZ = [
  ['America/Noronha', 'Fernando de Noronha (UTC−2)'],
  ['America/Sao_Paulo', 'Brasília (UTC−3)'],
  ['America/Manaus', 'Amazonas, MT, MS, RO, RR (UTC−4)'],
  ['America/Rio_Branco', 'Acre (UTC−5)'],
];
function tzField(current) {
  const tz = current || 'America/Sao_Paulo';
  const opts = BR_TZ.some(([v]) => v === tz) ? BR_TZ : [...BR_TZ, [tz, tz.replace('America/', '').replace('_', ' ')]];
  return `<div><label class="mono text-[10px] uppercase text-on-surface-variant">Fuso horário da unidade</label>
    <select id="uni-tz" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] text-on-surface border border-transparent focus:border-primary">
      ${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === tz ? 'selected' : ''}>${esc(l)}</option>`).join('')}
    </select></div>`;
}

const UNI_LABEL = 'mono text-[10px] uppercase text-on-surface-variant';
const UNI_INPUT = 'w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] text-on-surface placeholder:text-outline-variant border border-transparent focus:border-primary';

export function unidadeSheet() {
  const u = getUnidade(); window.__uniLogo = u.logo || null;
  const fld = (id, label, val, ph) => `<div><label class="mono text-[10px] uppercase text-on-surface-variant">${label}</label><input id="${id}" value="${esc(val || '')}" placeholder="${esc(ph || '')}" class="w-full mt-1 bg-surface-container-low rounded-lg px-3 py-2.5 text-[14px] text-on-surface placeholder:text-outline-variant border border-transparent focus:border-primary"></div>`;
  $('modal-root').innerHTML = `<div class="fixed inset-0 z-50 fade-in flex items-center justify-center p-4" data-close-modal>
    <div class="absolute inset-0 bg-black/40" data-close-modal></div>
    <div class="relative bg-surface-container-lowest rounded-2xl w-full max-w-[420px] max-h-[88dvh] overflow-y-auto scroll-area shadow-2xl p-4">
      <div class="flex items-center gap-3 pb-3 border-b border-outline-variant/40">
        <div class="flex-1"><div class="font-semibold text-on-surface">Dados da unidade</div><div class="text-[12px] text-on-surface-variant">Identificação usada nos registros e relatórios (MAPA/SIF)</div></div>
        <button data-action="close-x" class="tap w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant">${icon('close', 'text-[20px]')}</button>
      </div>
      <div class="flex items-center gap-3 py-3">
        <div id="uni-logo-prev" class="w-16 h-16 rounded-lg bg-surface-container flex items-center justify-center overflow-hidden flex-none">${u.logo ? `<img src="${u.logo}" class="w-full h-full object-contain">` : icon('image', 'text-on-surface-variant text-[24px]')}</div>
        <div class="flex-1"><div class="text-[13px] font-medium text-on-surface">Logo da empresa</div><div class="text-[11px] text-on-surface-variant mb-1">PNG/JPG · aparece no topo dos PDFs</div>
          <label class="tap inline-flex items-center gap-1.5 bg-surface-container text-primary rounded-lg px-3 py-1.5 text-[12px] font-semibold cursor-pointer">${icon('upload', 'text-[16px]')} Enviar logo<input id="uni-logo" type="file" accept="image/*" class="hidden"></label></div>
      </div>
      <div class="space-y-3">
        ${fld('uni-razao', 'Razão Social', u.razaoSocial)}
        <div class="grid grid-cols-2 gap-2">${cnpjField('uni-cnpj', 'CNPJ', u.cnpj, UNI_INPUT, UNI_LABEL)}${fld('uni-sif', 'Nº do SIF/registro', u.sif)}</div>
        ${fld('uni-marca', 'Marca (se houver)', u.marca)}
        ${fld('uni-end', 'Endereço', u.endereco)}
        ${municipioField('uni-mun', u.municipio, UNI_INPUT, UNI_LABEL)}
        <div class="grid grid-cols-2 gap-2">${fld('uni-rt', 'Responsável Técnico', u.rtNome)}${fld('uni-rtreg', 'Registro (CRMV)', u.rtRegistro)}</div>
        ${tzField(u.timezone)}
      </div>
      <button data-action="save-unidade" class="tap w-full mt-4 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px]">Salvar dados da unidade</button>
    </div></div>`;
  wireBrFields('uni-cnpj', 'uni-mun');
  const li = $('uni-logo'); if (li) li.onchange = () => {
    const f = li.files && li.files[0]; if (!f) return;
    if (f.size > 1500000) { toast('Logo muito grande (máx ~1,5MB).', 'err'); return; }
    const r = new FileReader();
    r.onload = () => { window.__uniLogo = r.result; const pv = $('uni-logo-prev'); if (pv) pv.innerHTML = `<img src="${r.result}" class="w-full h-full object-contain">`; };
    r.readAsDataURL(f);
  };
}

export async function saveUnidade() {
  const br = readBrFields('uni-cnpj', 'uni-mun');
  if (br.error) { toast(br.error, 'err'); return; }
  const payload = {
    razaoSocial: $('uni-razao').value.trim(), cnpj: br.cnpj, sif: $('uni-sif').value.trim(),
    marca: $('uni-marca').value.trim(), endereco: $('uni-end').value.trim(), municipio: br.municipio,
    rtNome: $('uni-rt').value.trim(), rtRegistro: $('uni-rtreg').value.trim(), logo: window.__uniLogo || null,
    timezone: $('uni-tz').value,
  };
  try { await api.saveUnidade(payload); await api.refreshState(); closeModal(); toast('Dados da unidade salvos.'); }
  catch (e) { toast(e.message || 'Não foi possível salvar.', 'err'); }
}
