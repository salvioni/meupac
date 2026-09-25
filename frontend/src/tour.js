// Tutorial interativo do gestor: destaca na tela onde tocar (PACs → ligar/desligar →
// abrir um PAC → Nova Planilha → editor → Equipe → turnos → Convidar → planilhas do
// operador) e avança sozinho quando a pessoa faz o passo. Nos passos do editor, o
// "Próximo" só libera com o campo preenchido. Começa sozinho numa unidade sem nenhuma
// planilha; dá pra pular e recomeçar pelo cartão "Primeiros passos" do painel.
//
// Estilos inline de propósito: o Tailwind do CDN gera classes de forma assíncrona, então
// o balão e o destaque não podem depender delas. Pelo mesmo motivo a posição é
// recalculada a cada 250 ms (o alvo muda de tamanho quando as classes chegam).
import { DB, currentUser, screen, params, getForm, getPac, unitTurnos } from './state.js';
import { turnosDefinidos } from './schedule.js';
import { titleProblem, whenProblem, fillProblem, paramsProblem } from './screens/formEditor.js';
import { esc } from './helpers.js';

// exemplo de planilha de cada PAC, pro tutorial falar do PAC que a pessoa abriu
// (e não de cloro quando ela está em Manutenção)
const EXAMPLES = {
  'PAC 01': ['Verificação de equipamentos', 'estado de conservação (conforme/não conforme)'],
  'PAC 02': ['Controle de cloro e pH da água', 'cloro livre entre 0,5 e 2,0 ppm'],
  'PAC 03': ['Inspeção de armadilhas e iscas', 'sinais de pragas em cada ponto'],
  'PAC 04': ['Higienização pós-operacional', 'limpeza de pisos, paredes e equipamentos'],
  'PAC 05': ['Barreira sanitária', 'uniforme completo e mãos higienizadas'],
  'PAC 06': ['PSO pré-operacional', 'mesas, esteiras e utensílios limpos antes de começar'],
  'PAC 07': ['Recebimento de matéria-prima', 'temperatura e documentação do lote'],
  'PAC 08': ['Temperatura das câmaras frias', 'câmara de resfriados entre −1 e 4 °C'],
  'PAC 09': ['Monitoramento do PCC', 'o limite crítico do ponto de controle'],
  'PAC 10': ['Coleta de amostras', 'amostra coletada e enviada ao laboratório'],
  'PAC 11': ['Conferência de formulação', 'ingredientes e quantidades da receita'],
  'PAC 12': ['Rastreabilidade de lotes', 'lote e data de produção identificados'],
  'PAC 13': ['Conferência para certificação', 'documentos do lote certificado'],
  'PAC 14': ['Bem-estar no desembarque', 'condução e descanso dos animais'],
  'PAC 15': ['Segregação de MER', 'retirada e destino de cada material'],
};
function example() {
  const f = params.form ? getForm(params.form) : null;
  const pac = getPac(f ? f.pacId : params.pac);
  return (pac && EXAMPLES[pac.code]) || ['Controle diário', 'o que precisa ser conferido'];
}

// sugere a Água (costuma ser a primeira planilha de uma unidade); se estiver desligada, o primeiro PAC ligado
function suggestedPac() {
  const on = DB.pacs.filter(p => p.active !== false);
  const p = on.find(x => x.code === 'PAC 02') || on[0] || DB.pacs[0];
  return p ? `[data-action="open-pac"][data-pac="${p.id}"]` : '[data-action="open-pac"]';
}

const operators = () => (DB.team || []).filter(t => t.role === 'operador' && t.active !== false);
const hasOperator = () => operators().length > 0;
const hasAccess = () => operators().some(t => (t.ownedFormIds || []).length > 0);
const modalOpen = () => !!document.querySelector('#modal-root > *');

// target/text podem ser funções; ready() devolve o que falta (trava o "Próximo");
// modal: true = o passo continua na tela com uma folha aberta (turnos, acessos)
const STEPS = [
  { id: 'welcome', screens: ['ge_painel'], title: 'Bem-vindo ao meuPAC', next: 'Começar',
    text: 'Em poucos passos sua unidade fica pronta: escolher os PACs, criar a primeira planilha, definir o expediente e dar acesso a quem vai preencher.' },
  { id: 'nav-pacs', screens: ['ge_painel', 'ge_hist', 'ge_equipe'], target: '[data-action="nav"][data-nav="ge_forms"]',
    text: 'Toque em <b>PACs</b>.', until: () => screen === 'ge_forms' },
  { id: 'toggle', screens: ['ge_forms'], target: '[data-action="toggle-pac-active"]', title: 'Ligue só o que a unidade usa', next: 'Entendi',
    text: 'Estes são os 15 PACs do RIISPOA, todos ligados. Desligue no botão ao lado os que sua unidade não usa — dá pra mudar a qualquer hora.' },
  { id: 'open-pac', screens: ['ge_forms'], target: suggestedPac,
    text: 'Toque num PAC para criar as planilhas dele — por exemplo <b>Água de Abastecimento</b>. Pode ser qualquer um.', until: () => screen === 'ge_pac_forms' },
  { id: 'new-form', screens: ['ge_pac_forms'], target: '[data-action="new-form"]',
    text: 'Toque em <b>Nova Planilha</b> para criar o que o operador vai preencher.', until: () => screen === 'ge_form_editor' },
  { id: 'ed-title', screens: ['ge_form_editor'], target: '#ed-title', next: 'Próximo', ready: titleProblem,
    text: () => `Dê um nome à planilha. Ex.: “${example()[0]}”.` },
  { id: 'ed-when', screens: ['ge_form_editor'], target: '#ed-when-wrap', next: 'Próximo', ready: whenProblem,
    text: 'Escolha <b>quando</b> preencher: horários fixos, a cada X horas, X vezes ao dia, no início/fim do turno ou sob demanda. Em <b>Fixos</b>, toque em <b>Adicionar horário</b> (ou ligue “Sem horário específico”). Depois marque os <b>dias</b>.' },
  { id: 'ed-fill', screens: ['ge_form_editor'], target: '#ed-fill', next: 'Próximo', ready: fillProblem,
    text: '<b>Quem preenche?</b> “Basta um” quando o registro é do local ou do processo (cloro, temperatura). “Cada pessoa” quando cada um registra o seu (saúde, uniforme).' },
  { id: 'ed-params', screens: ['ge_form_editor'], target: '#ed-params', next: 'Próximo', ready: paramsProblem,
    text: () => `O que o operador confere — ex.: ${example()[1]}. Dê um título e, em Mín/Máx, a faixa aceitável: fora dela vira <b>não conformidade</b> no painel.` },
  { id: 'ed-save', screens: ['ge_form_editor'], target: '[data-action="save-form"]',
    text: 'Pronto? Toque em <b>Criar Planilha</b>.', until: () => DB.forms.length > 0 },
  { id: 'nav-equipe', screens: ['ge_painel', 'ge_hist', 'ge_forms', 'ge_pac_forms'], target: '[data-action="nav"][data-nav="ge_equipe"]', title: 'Planilha criada!',
    text: 'Agora vamos preparar a equipe. Toque em <b>Equipe</b>.', until: () => screen === 'ge_equipe' },
  { id: 'turnos', screens: ['ge_equipe'], modal: true, until: () => turnosDefinidos(unitTurnos()),
    target: () => (modalOpen() ? '#uni-t0-times, [data-action="save-turnos"]' : '[data-action="edit-turnos"]'),
    text: () => (modalOpen() ? 'Informe o início e o fim do expediente (e ligue o 2º turno, se houver) e toque em <b>Salvar turnos</b>.'
      : 'Primeiro, o horário do expediente da fábrica. Toque em <b>Definir</b>.') },
  { id: 'invite', screens: ['ge_equipe'], target: '[data-action="invite"]', until: hasOperator,
    text: 'Agora toque em <b>Convidar</b> e crie o login e a senha de quem vai preencher.' },
  { id: 'access', screens: ['ge_equipe'], modal: true, until: hasAccess, next: 'Deixar para todos',
    target: () => (modalOpen() ? '[data-action="edit-form-toggle"], [data-action="save-member"]' : '[data-action="edit-member"]'),
    text: () => (modalOpen() ? 'Marque as planilhas que ele preenche e toque em <b>Salvar acessos</b>.'
      : 'Escolha as planilhas desse operador: toque aqui. (Planilha sem ninguém marcado fica liberada para todos os operadores.)') },
  { id: 'done', screens: ['ge_painel', 'ge_hist', 'ge_forms', 'ge_pac_forms', 'ge_equipe'], title: 'Tudo pronto!', next: 'Fechar',
    text: 'O operador entra com o login dele e preenche. Os registros aparecem no <b>Painel</b> para você assinar. Dá pra criar mais planilhas em PACs quando quiser.' },
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
// um seletor com vírgula destaca a área que cobre todos (ex.: lista + botão salvar),
// pra o balão não cair em cima do botão que a pessoa precisa tocar
function findTarget(sel) {
  const els = [...document.querySelectorAll(sel)].filter(visible);
  if (!els.length) return null;
  if (!sel.includes(',')) return els[0];
  return { els, getBoundingClientRect() {
    const rs = els.map(e => e.getBoundingClientRect());
    const left = Math.min(...rs.map(r => r.left)), top = Math.min(...rs.map(r => r.top));
    const right = Math.max(...rs.map(r => r.right)), bottom = Math.max(...rs.map(r => r.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }, scrollIntoView(o) { els[els.length - 1].scrollIntoView(o); } };
}

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
  if (!step.screens.includes(screen) || (modalOpen() && !step.modal)) { hideBubbleOnly(); ensureTimer(); return; }
  const target = step.target ? findTarget(typeof step.target === 'function' ? step.target() : step.target) : null;
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
      if (b.dataset.tourBtn === 'next') { if (!b.disabled) advance(); } else skipTour();
    });
  }
  root.style.display = '';
  const spot = root.querySelector('[data-tour-spot]'), dim = root.querySelector('[data-tour-dim]'), bubble = root.querySelector('[data-tour-bubble]');

  const shownKey = step.id + (modalOpen() ? ':modal' : '');
  if (shownStep !== shownKey) {
    shownStep = shownKey;
    const n = STEPS.indexOf(step);
    bubble.innerHTML = `${step.title ? `<div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(step.title)}</div>` : ''}
      <div style="color:#44474d">${typeof step.text === 'function' ? step.text() : step.text}</div>
      <div data-tour-hint style="display:none;margin-top:8px;font-size:12px;font-weight:600;color:#8a4505"></div>
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

  // "Próximo" travado enquanto falta preencher (passos do editor)
  const problem = step.ready ? step.ready() : null;
  const nextBtn = bubble.querySelector('[data-tour-btn="next"]'), hint = bubble.querySelector('[data-tour-hint]');
  if (nextBtn) { nextBtn.disabled = !!problem; nextBtn.style.opacity = problem ? '.4' : '1'; nextBtn.style.cursor = problem ? 'not-allowed' : 'pointer'; }
  if (hint) { hint.textContent = problem || ''; hint.style.display = problem ? '' : 'none'; }
  // com uma folha aberta (z-50), o tutorial fica por cima dela
  const z = modalOpen() ? 60 : 45;
  spot.style.zIndex = dim.style.zIndex = z; bubble.style.zIndex = z + 1;

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
  // numa folha aberta, o balão vai acima (embaixo costuma estar o botão de salvar)
  const top = modalOpen() && above >= 8 ? above : below + bh <= vh - 8 ? below : above >= 8 ? above : Math.max(8, vh - bh - 8);
  const left = Math.min(Math.max(16, r.left + r.width / 2 - bw / 2), vw - bw - 16);
  bubble.style.left = Math.round(left) + 'px';
  bubble.style.top = Math.round(top) + 'px';
}
