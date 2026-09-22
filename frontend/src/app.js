import * as api from './api.js';
import { initEventDelegation, render, navigate } from './router.js';
import { toast } from './helpers.js';

initEventDelegation();

async function boot() {
  if (api.hasToken()) {
    const user = await api.tryResumeSession();
    if (user) {
      try {
        await api.refreshState();
        navigate(user.role === 'operador' ? 'op_pac' : 'ge_painel');
        return;
      } catch (e) { toast(e.message || 'Não foi possível carregar os dados.', 'err'); }
    }
  }
  render(); // sem sessão válida -> tela de login
}

boot();
