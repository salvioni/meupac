import { $, esc, icon, toast } from '../helpers.js';
import { logo } from '../ui.js';
import * as api from '../api.js';
import { afterLogin } from '../router.js';

const app = () => $('app');

export function renderLogin() {
  app().innerHTML = `
  <div class="min-h-[100dvh] flex flex-col justify-between p-6 pt-safe pb-safe bg-surface">
    <div class="pt-16 fade-in">
      ${logo('text-4xl')}
      <p class="mono text-[11px] tracking-widest uppercase text-on-surface-variant mt-3">Programas de Autocontrole · MAPA/SIF</p>
      <h1 class="text-[28px] leading-tight font-bold text-on-surface mt-6">Controle de qualidade,<br>sem papel e à prova de auditoria.</h1>
      <p class="text-[14px] text-on-surface-variant mt-3 max-w-[320px]">Entre com seu usuário e senha. Cada registro é assinado digitalmente e rastreável.</p>
    </div>
    <form id="login-form" class="space-y-3 pb-4">
      <div id="login-err" class="hidden bg-nc-bg text-nc-tx text-[13px] font-medium rounded-lg px-3 py-2.5"></div>
      <div>
        <label class="mono text-[10px] uppercase tracking-widest text-on-surface-variant">Usuário</label>
        <input id="login-user" autocomplete="username" placeholder="joao" class="w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-[14px] text-on-surface focus:border-primary">
      </div>
      <div>
        <label class="mono text-[10px] uppercase tracking-widest text-on-surface-variant">Senha</label>
        <input id="login-pass" type="password" autocomplete="current-password" placeholder="••••••••" class="w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-[14px] text-on-surface focus:border-primary">
      </div>
      <button type="submit" id="login-submit" class="tap w-full flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-[14px]">${icon('login', '', true)} Entrar</button>
    </form>
  </div>`;

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
}
