export const OP_NAV = [{ key: 'op_pac', icon: 'edit_note', label: 'Preencher' }, { key: 'op_hist', icon: 'history', label: 'Histórico' }];
export const GE_NAV = [{ key: 'ge_painel', icon: 'space_dashboard', label: 'Painel' }, { key: 'ge_hist', icon: 'history', label: 'Histórico' }, { key: 'ge_forms', icon: 'assignment', label: 'PACs' }, { key: 'ge_equipe', icon: 'group', label: 'Equipe' }];

export const STATUS_META = {
  atrasado: { label: 'Atrasado', bg: 'bg-nc-bg', tx: 'text-nc-tx', dot: '#b91c1c' },
  pendente: { label: 'A Fazer', bg: 'bg-pend-bg', tx: 'text-pend-tx', dot: '#b46514' },
  afazer: { label: 'A Fazer', bg: 'bg-pend-bg', tx: 'text-pend-tx', dot: '#b46514' },
  agendado: { label: 'A Fazer', bg: 'bg-pend-bg', tx: 'text-pend-tx', dot: '#b46514' },
  concluido: { label: 'Concluído', bg: 'bg-conf-bg', tx: 'text-conf-tx', dot: '#1b6e4a' },
  ocorrencia: { label: 'Ocorrência', bg: 'bg-nc-bg', tx: 'text-nc-tx', dot: '#b91c1c' },
};

export const API_BASE = '/api';
export const TOKEN_KEY = 'meupac_token_v1';
