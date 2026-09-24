// Tutorial interativo do gestor: destaca na tela onde tocar (PACs → ligar/desligar →
// abrir um PAC → Nova Planilha → editor → Equipe → Convidar) e avança sozinho quando a
// pessoa faz o passo. Começa sozinho numa unidade sem nenhuma planilha; dá pra pular e
// recomeçar pelo cartão "Primeiros passos" do painel.
//
// Estilos inline de propósito: o Tailwind do CDN gera classes de forma assíncrona, então
// o balão e o destaque não podem depender delas. Pelo mesmo motivo a posição é
// recalculada a cada 250 ms (o alvo muda de tamanho quando as classes chegam).
import { DB, currentUser, screen } from './state.js';
import { esc } from './helpers.js';

const hasOperator = () => (DB.team || []).some(t => t.role === 'operador' && t.active !== false);

const STEPS = [
  { id: 'welcome', screens: ['ge_painel'], title: 'Bem-vindo ao meuPAC', next: 'Começar',
    text: 'Em poucos passos sua unidade fica pronta: escolher os PACs, criar a primeira planilha e dar acesso a quem vai preencher.' },
  { id: 'nav-pacs', screens: ['ge_painel', 'ge_hist', 'ge_equipe'], target: '[data-action="nav"][data-nav="ge_forms"]',
    text: 'Toque em <b>PACs</b>.', until: () => screen === 'ge_forms' },
  { id: 'toggle', screens: ['ge_forms'], target: '[data-action="toggle-pac-active"]', title: 'Ligue só o que a unidade usa', next: 'Entendi',
    text: 'Estes são os 15 PACs do RIISPOA, todos ligados. Desligue no botão ao lado os que sua unidade não usa — dá pra mudar a qualquer hora.' },
  { id: 'open-pac', screens: ['ge_forms'], target: '[data-action="open-pac"]',
    text: 'Toque num PAC para ver e criar as planilhas dele.', until: () => screen === 'ge_pac_forms' },
  { id: 'new-form', screens: ['ge_pac_forms'], target: '[data-action="new-form"]',
    text: 'Toque em <b>Nova Planilha</b> para criar o que o operador vai preencher.', until: () => screen === 'ge_form_editor' },
  { id: 'ed-title', screens: ['ge_form_editor'], target: '#ed-title', next: 'Próximo',
    text: 'Dê um nome à planilha. Ex.: “Controle de Cloro”.' },
  { id: 'ed-when', screens: ['ge_form_editor'], target: '#ed-when-wrap', next: 'Próximo',
    text: 'Escolha <b>quando</b> preencher: horários fixos, a cada X horas, X vezes ao dia, no início/fim do turno ou sob demanda. Em <b>Fixos</b>, toque em <b>Adicionar horário</b> (ou ligue “Sem horário específico”).' },
  { id: 'ed-params', screens: ['ge_form_editor'], target: '#ed-params', next: 'Próximo',
    text: 'O que o operador mede e a faixa aceitável. Valor fora da faixa vira <b>não conformidade</b> no painel.' },
  { id: 'ed-save', screens: ['ge_form_editor'], target: '[data-action="save-form"]',
    text: 'Pronto? Toque em <b>Criar Planilha</b>.', until: () => DB.forms.length > 0 },
  { id: 'nav-equipe', screens: ['ge_painel', 'ge_hist', 'ge_forms', 'ge_pac_forms'], target: '[data-action="nav"][data-nav="ge_equipe"]', title: 'Planilha criada!',
    text: 'Agora crie o acesso de quem vai preencher. Toque em <b>Equipe</b>.', until: () => screen === 'ge_equipe' || hasOperator() },
  { id: 'invite', screens: ['ge_equipe'], target: '[data-action="invite"]',
    text: 'Toque em <b>Convidar</b>, crie login e senha e escolha o turno. O operador entra com esse login e vê as planilhas do turno dele.', until: hasOperator },
  { id: 'done', screens: ['ge_painel', 'ge_hist', 'ge_forms', 'ge_pac_forms', 'ge_equipe'], title: 'Tudo pronto!', next: 'Fechar',
    text: 'Quando o operador enviar, os registros aparecem no <b>Painel</b> para você assinar. Dá pra criar mais planilhas em PACs quando quiser.' },
];

const key = () => 'meupac_tour_v1_' + (currentUser ? currentUser.id : '');
function load() { try { return JSON.parse(localStorage.getItem(key())) || null; } catch (e) { return null; } }
function save(s) { try { localStorage.setItem(key(), JSON.stringify(s)); } catch (e) { /* sem storage: vale só nesta aba */ } }

let st = null; // { step, done }
let timer = null, shownStep = null;

function state() {
  if (!st || st.user !== (currentUser && currentUser.id)) {
    st = load();
    // começa sozinho só numa unidade vazia (nenhuma planilha ainda)
    if (!st) st = { step: 0, done: DB.forms.length > 0 };
    st.user = currentUser && currentUser.id;
  }
  return st;
}

// recomeça pelo passo que falta (cartão "Primeiros passos" do painel)
export function startTour() {
  st = { step: DB.forms.length ? STEPS.findIndex(s => s.id === 'nav-equipe') : 1, done: false, user: currentUser.id };
  save(st); tourTick();
}
export function skipTour() { const s = state(); s.done = true; save(s); hide(); }

function advance() {
  const s = state(); s.step++;
  if (s.step >= STEPS.length) s.done = true;
  save(s); tourTick();
}

function visible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
function findTarget(sel) { return [...document.querySelectorAll(sel)].find(visible) || null; }

function hide() {
  const root = document.getElementById('tour-root'); if (root) root.remove();
  shownStep = null;
  if (timer) { clearInterval(timer); timer = null; }
}

// chamado depois de cada render (router) e a cada 250 ms enquanto o tutorial está na tela
export function tourTick() {
  if (!currentUser || currentUser.role !== 'gerente') { hide(); return; }
  const s = state();
  if (s.done) { hide(); return; }
  // passos já cumpridos (ex.: já está na tela de PACs) pulam sozinhos
  while (s.step < STEPS.length && STEPS[s.step].until && STEPS[s.step].until()) s.step++;
  if (s.step >= STEPS.length) { s.done = true; save(s); hide(); return; }
  save(s);
  const step = STEPS[s.step];
  const modalOpen = !!document.querySelector('#modal-root > *');
  if (!step.screens.includes(screen) || modalOpen) { hideBubbleOnly(); ensureTimer(); return; }
  const target = step.target ? findTarget(step.target) : null;
  if (step.target && !target) { hideBubbleOnly(); ensureTimer(); return; } // tela ainda carregando
  paint(step, target);
  ensureTimer();
}

function ensureTimer() { if (!timer) timer = setInterval(tourTick, 250); }
function hideBubbleOnly() { const root = document.getElementById('tour-root'); if (root) root.style.display = 'none'; shownStep = null; }

function paint(step, target) {
  let root = document.getElementById('tour-root');
  if (!root) {
    root = document.createElement('div'); root.id = 'tour-root';
    root.innerHTML = `<div data-tour-spot style="position:fixed;border-radius:12px;pointer-events:none;z-index:45;box-shadow:0 0 0 3px #a1f1c3,0 0 0 9999px rgba(15,38,66,.55);transition:all .2s ease"></div>
      <div data-tour-dim style="position:fixed;inset:0;background:rgba(15,38,66,.55);z-index:45;pointer-events:none"></div>
      <div data-tour-bubble role="dialog" style="position:fixed;z-index:46;width:min(320px,calc(100vw - 32px));background:#fff;color:#121c29;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.25);padding:14px 16px;font-size:14px;line-height:1.4"></div>`;
    document.body.appendChild(root);
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-tour-btn]'); if (!b) return;
      if (b.dataset.tourBtn === 'next') advance(); else skipTour();
    });
  }
  root.style.display = '';
  const spot = root.querySelector('[data-tour-spot]'), dim = root.querySelector('[data-tour-dim]'), bubble = root.querySelector('[data-tour-bubble]');

  if (shownStep !== step.id) {
    shownStep = step.id;
    const n = STEPS.indexOf(step);
    bubble.innerHTML = `${step.title ? `<div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(step.title)}</div>` : ''}
      <div style="color:#44474d">${step.text}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px">
        <button data-tour-btn="skip" style="background:none;border:0;padding:6px 0;color:#44474d;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer">${step.id === 'done' ? '' : 'Pular tutorial'}</button>
        <span style="display:flex;align-items:center;gap:10px">
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#74777e">${n + 1}/${STEPS.length}</span>
          ${step.next ? `<button data-tour-btn="next" style="background:#0f2642;color:#fff;border:0;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer">${esc(step.next)}</button>` : ''}
        </span>
      </div>`;
    // o alvo pode estar fora da tela (ex.: botão salvar no fim do editor)
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  const vw = window.innerWidth, vh = window.innerHeight, bw = Math.min(320, vw - 32);
  if (!target) {
    // sem alvo: balão no centro, tela escurecida
    spot.style.display = 'none'; dim.style.display = '';
    bubble.style.left = Math.round((vw - bw) / 2) + 'px';
    bubble.style.top = Math.round(vh * 0.3) + 'px';
    return;
  }
  dim.style.display = 'none'; spot.style.display = '';
  const r = target.getBoundingClientRect(), pad = 6;
  Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
  const bh = bubble.offsetHeight || 140;
  const below = r.bottom + pad + 12, above = r.top - pad - 12 - bh;
  const top = below + bh <= vh - 8 ? below : above >= 8 ? above : Math.max(8, vh - bh - 8);
  const left = Math.min(Math.max(16, r.left + r.width / 2 - bw / 2), vw - bw - 16);
  bubble.style.left = Math.round(left) + 'px';
  bubble.style.top = Math.round(top) + 'px';
}
