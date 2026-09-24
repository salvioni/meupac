import { $, icon } from '../helpers.js';
import { logo } from '../ui.js';
import * as api from '../api.js';
import { afterLogin } from '../router.js';

const app = () => $('app');

// tela de login não passa pelo estado de navegação normal do app (o router força
// renderLogin() sempre que não há usuário logado) — então login/cadastro/esqueci-a-senha
// são só um modo local desta tela, trocado sem sair de renderLogin(). A landing page
// de marketing mora fora do app (landing.html); esta tela aqui vira uma página web
// normal e responsiva (a moldura de celular é desligada via classe "web" em router.js).
let mode = 'login';
export function setLoginMode(m) { mode = m; if (m === 'signup') { signupStep = 1; signupData = {}; } }

export function renderLogin() {
  if (mode === 'signup') return renderSignupView();
  if (mode === 'forgot') return renderForgotView();
  return renderLoginView();
}

// casca comum: fundo com glow, topo com logo linkando pro site, card centralizado
function shell(inner, { width = 440 } = {}) {
  return `<div class="relative min-h-[100dvh] overflow-hidden bg-surface flex flex-col">
    <div class="glow w-[420px] h-[420px] bg-inverse-primary/50 -top-32 -right-24"></div>
    <div class="glow w-[360px] h-[360px] bg-secondary-container/40 bottom-0 -left-32"></div>
    <header class="relative z-10 px-6 sm:px-10 h-16 flex items-center flex-none">
      <a href="/">${logo('text-[18px]')}</a>
    </header>
    <main class="relative z-10 flex-1 flex items-center justify-center px-5 py-8">
      <div class="w-full fade-in" style="max-width:${width}px">
        <div class="bg-white rounded-2xl shadow-xl border border-outline-variant/40 p-6 sm:p-9">${inner}</div>
      </div>
    </main>
  </div>`;
}

// troca de modo é sempre feita por delegação no document (não escopada a um form),
// porque nem todo botão data-go fica dentro de um <form>.
function wireGo() {
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    mode = b.dataset.go;
    if (mode === 'signup') { signupStep = 1; signupData = {}; }
    renderLogin();
  });
}

function renderLoginView() {
  app().innerHTML = shell(`
    <h1 class="font-brand text-[24px] sm:text-[26px] leading-tight font-bold text-on-surface">Entrar</h1>
    <p class="text-[13px] text-on-surface-variant mt-2 mb-6">Use o usuário e a senha da sua unidade. Cada registro é assinado digitalmente e rastreável.</p>
    <form id="login-form" class="space-y-3">
      <div id="login-err" class="hidden bg-nc-bg text-nc-tx text-[13px] font-medium rounded-lg px-3 py-2.5"></div>
      <div>
        <label class="mono text-[10px] uppercase tracking-widest text-on-surface-variant">Usuário</label>
        <input id="login-user" autocomplete="username" placeholder="joao" class="w-full mt-1 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-[14px] text-on-surface focus:border-primary">
      </div>
      <div>
        <div class="flex items-center justify-between">
          <label class="mono text-[10px] uppercase tracking-widest text-on-surface-variant">Senha</label>
          <button type="button" data-go="forgot" class="text-[12px] font-semibold text-on-surface-variant">Esqueci minha senha</button>
        </div>
        <input id="login-pass" type="password" autocomplete="current-password" placeholder="••••••••" class="w-full mt-1 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-[14px] text-on-surface focus:border-primary">
      </div>
      <button type="submit" id="login-submit" class="tap w-full flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px] mt-1">${icon('login', '', true)} Entrar</button>
    </form>
    <p class="text-center text-[13px] text-on-surface-variant mt-6">Não tem conta? <button type="button" data-go="signup" class="font-semibold text-primary">Cadastre-se</button></p>`);

  const form = $('login-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const username = $('login-user').value.trim();
    const password = $('login-pass').value;
    const errBox = $('login-err'); errBox.classList.add('hidden');
    const btn = $('login-submit'); btn.disabled = true; btn.classList.add('opacity-60');
    try {
      const user = await api.login(username, password);
      await afterLogin(user);
    } catch (err) {
      errBox.textContent = err.message || 'Não foi possível entrar.';
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.classList.remove('opacity-60');
    }
  };
  wireGo();
}

const field = (id, label, ph, opts = '', val = '') => `<div>
    <label class="mono text-[10px] uppercase tracking-widest text-on-surface-variant">${label}</label>
    <input id="${id}" ${opts} value="${val}" placeholder="${ph}" class="w-full mt-1 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-[14px] text-on-surface focus:border-primary">
  </div>`;
const stepDots = (n) => `<div class="flex items-center gap-1.5 mb-5">
    <span class="h-1.5 rounded-full ${n >= 1 ? 'bg-primary' : 'bg-outline-variant'} flex-1"></span>
    <span class="h-1.5 rounded-full ${n >= 2 ? 'bg-primary' : 'bg-outline-variant'} flex-1"></span>
  </div>`;

// dados coletados no passo 1, carregados de novo se a pessoa voltar do passo 2
let signupStep = 1;
let signupData = {};

function renderSignupView() {
  if (signupStep === 2) return renderSignupStep2();
  return renderSignupStep1();
}

function renderSignupStep1() {
  app().innerHTML = shell(`
    ${stepDots(1)}
    <h1 class="font-brand text-[24px] sm:text-[26px] leading-tight font-bold text-on-surface">Crie sua conta</h1>
    <p class="text-[13px] text-on-surface-variant mt-2 mb-6">Passo 1 de 2 — depois vem os dados da empresa.</p>
    <form id="signup-form-1" class="space-y-3">
      <div id="signup-err-1" class="hidden bg-nc-bg text-nc-tx text-[13px] font-medium rounded-lg px-3 py-2.5"></div>
      ${field('signup-nome', 'Seu nome (RT/responsável)', 'Dra. Camila Nogueira', '', signupData.adminName || '')}
      ${field('signup-user', 'Usuário (login)', 'camila', 'autocomplete="username"', signupData.username || '')}
      ${field('signup-pass', 'Senha', 'Mínimo 6 caracteres', 'type="password" autocomplete="new-password"', signupData.password || '')}
      <button type="submit" id="signup-submit-1" class="tap w-full flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px] mt-1">Continuar ${icon('arrow_forward', '', true)}</button>
    </form>
    <p class="text-center text-[13px] text-on-surface-variant mt-6">Já tem uma conta? <button type="button" data-go="login" class="font-semibold text-primary">Faça login</button></p>`, { width: 440 });

  const form = $('signup-form-1');
  form.onsubmit = (e) => {
    e.preventDefault();
    const adminName = $('signup-nome').value.trim();
    const username = $('signup-user').value.trim();
    const password = $('signup-pass').value;
    const errBox = $('signup-err-1'); errBox.classList.add('hidden');
    if (!adminName || !username || !password) {
      errBox.textContent = 'Preencha seu nome, usuário e senha.'; errBox.classList.remove('hidden'); return;
    }
    if (password.length < 6) {
      errBox.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; errBox.classList.remove('hidden'); return;
    }
    signupData = { ...signupData, adminName, username, password };
    signupStep = 2;
    renderLogin();
  };
  wireGo();
}

function renderSignupStep2() {
  app().innerHTML = shell(`
    <button type="button" id="signup-back" class="tap inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary mb-4">${icon('arrow_back', 'text-[18px]')} Voltar</button>
    ${stepDots(2)}
    <h1 class="font-brand text-[24px] sm:text-[26px] leading-tight font-bold text-on-surface">Dados da empresa</h1>
    <p class="text-[13px] text-on-surface-variant mt-2 mb-6">Passo 2 de 2 — aparecem nos relatórios e PDFs assinados. Só a razão social é obrigatória; o resto dá pra completar depois em "Dados da unidade".</p>
    <form id="signup-form-2" class="space-y-3">
      <div id="signup-err-2" class="hidden bg-nc-bg text-nc-tx text-[13px] font-medium rounded-lg px-3 py-2.5"></div>
      <div class="grid sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2">${field('signup-empresa', 'Razão social', 'Frigorífico Serra Verde Ltda.', '', signupData.razaoSocial || '')}</div>
        ${field('signup-cnpj', 'CNPJ', '12.345.678/0001-90', '', signupData.cnpj || '')}
        ${field('signup-sif', 'Nº do SIF/registro', 'SIF 4412', '', signupData.sif || '')}
        <div class="sm:col-span-2">${field('signup-endereco', 'Endereço', 'Rod. BR-262, km 12 — Zona Rural', '', signupData.endereco || '')}</div>
        ${field('signup-municipio', 'Município/UF', 'Serra Verde/MG', '', signupData.municipio || '')}
        ${field('signup-rtregistro', 'Registro do RT (CRMV)', 'CRMV-SP 14.892', '', signupData.rtRegistro || '')}
      </div>
      <button type="submit" id="signup-submit-2" class="tap w-full flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px] mt-1">${icon('add_business', '', true)} Criar empresa e conta</button>
    </form>`, { width: 560 });

  $('signup-back').onclick = () => { signupStep = 1; renderLogin(); };

  const form = $('signup-form-2');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const razaoSocial = $('signup-empresa').value.trim();
    const errBox = $('signup-err-2'); errBox.classList.add('hidden');
    if (!razaoSocial) {
      errBox.textContent = 'Informe a razão social da empresa.'; errBox.classList.remove('hidden'); return;
    }
    const btn = $('signup-submit-2'); btn.disabled = true; btn.classList.add('opacity-60');
    try {
      const user = await api.signup({
        ...signupData, razaoSocial,
        // fuso da fábrica: o do navegador de quem cadastra (ajustável em Dados da unidade)
        timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return undefined; } })(),
        cnpj: $('signup-cnpj').value.trim(),
        sif: $('signup-sif').value.trim(),
        endereco: $('signup-endereco').value.trim(),
        municipio: $('signup-municipio').value.trim(),
        rtRegistro: $('signup-rtregistro').value.trim(),
      });
      mode = 'login'; signupStep = 1; signupData = {};
      await afterLogin(user);
    } catch (err) {
      errBox.textContent = err.message || 'Não foi possível criar a conta.';
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.classList.remove('opacity-60');
    }
  };
}

function renderForgotView() {
  app().innerHTML = shell(`
    <button type="button" data-go="login" class="tap inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary mb-6">${icon('arrow_back', 'text-[18px]')} Voltar para o login</button>
    <h1 class="font-brand text-[24px] sm:text-[26px] leading-tight font-bold text-on-surface">Esqueci minha senha</h1>
    <div class="bg-surface-container rounded-xl p-4 mt-5">
      <div class="flex items-start gap-2">${icon('info', 'text-primary text-[20px] flex-none', true)}
        <p class="text-[13px] text-on-surface-variant">Não existe redefinição por e-mail neste sistema. Peça ao <b class="text-on-surface">administrador ou a um gestor da sua unidade</b> para gerar uma nova senha temporária para você, na tela <b class="text-on-surface">Equipe</b>.</p>
      </div>
    </div>
    <button type="button" data-go="login" class="tap w-full bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px] mt-5">Voltar para o login</button>`);
  wireGo();
}
