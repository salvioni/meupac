import * as api from './api.js';
import { initEventDelegation, render, navigate } from './router.js';
import { toast } from './helpers.js';
import { setLoginMode } from './screens/login.js';

initEventDelegation();

async function boot() {
  if (api.hasToken()) {
    const user = await api.tryResumeSession();
    if (user) {
      try {
        await api.refreshState();
        // restaura a tela salva na URL (sobrevive a um F5); sem isso, cai no padrão do papel
        const qp = new URLSearchParams(location.search);
        const savedScreen = qp.get('screen');
        if (savedScreen) {
          const p = {}; for (const [k, v] of qp.entries()) if (k !== 'screen') p[k] = v;
          navigate(savedScreen, p, true);
        } else {
          navigate(user.role === 'operador' ? 'op_pac' : 'ge_painel', {}, true);
        }
        return;
      } catch (e) { toast(e.message || 'Não foi possível carregar os dados.', 'err'); }
    }
  }
  // veio do botão "Cadastrar empresa" da landing page (/app?signup=1) -> abre direto no cadastro
  if (new URLSearchParams(location.search).get('signup') === '1') setLoginMode('signup');
  render(); // sem sessão válida -> tela de login (ou cadastro, se veio da landing)
}

boot();
