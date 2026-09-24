import { API_BASE, TOKEN_KEY } from './config.js';
import { setDB, setCurrentUser, DB, currentUser } from './state.js';

let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* localStorage indisponível */ }

function setToken(t) {
  token = t;
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ok ignorar */ }
}
export function hasToken() { return !!token; }

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* resposta sem corpo */ }
  if (!res.ok) {
    if (res.status === 401) { setToken(null); setCurrentUser(null); }
    throw new Error((data && data.error) || `Erro (${res.status})`);
  }
  return data;
}

export async function login(username, password) {
  const data = await request('/auth/login', { method: 'POST', body: { username, password } });
  setToken(data.token);
  setCurrentUser(data.user);
  return data.user;
}

export async function signup(payload) {
  const data = await request('/auth/signup', { method: 'POST', body: payload });
  setToken(data.token);
  setCurrentUser(data.user);
  return data.user;
}

export function logout() { setToken(null); setCurrentUser(null); }

export async function tryResumeSession() {
  if (!token) return null;
  try {
    const data = await request('/auth/me');
    setCurrentUser(data.user);
    return data.user;
  } catch (e) { setToken(null); return null; }
}

export async function changePassword(currentPassword, newPassword) {
  return request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
}

export async function refreshState() {
  // o gestor precisa da equipe já no painel/PACs (nome de quem preenche cada planilha),
  // não só depois de abrir a tela Equipe — senão tudo aparece como "—" após login/F5.
  const isGestor = currentUser && currentUser.role === 'gerente';
  const [data, teamData] = await Promise.all([request('/state'), isGestor ? request('/team') : null]);
  setDB({ ...data, team: teamData ? teamData.team : DB.team });
  return data;
}

export async function fetchTeam() {
  const data = await request('/team');
  setDB({ ...DB, team: data.team });
  return data.team;
}

export async function createSubmission(formId, values, note, slot) {
  const data = await request('/submissions', { method: 'POST', body: { formId, values, note, slot: slot || null } });
  return data.submission;
}
export async function signSubmission(id) {
  const data = await request(`/submissions/${id}/sign`, { method: 'POST' });
  return data.submission;
}
export async function signAllToday() {
  const data = await request('/submissions/sign-all', { method: 'POST' });
  return data.signed;
}

export async function setPacActive(id, active) {
  const data = await request(`/pacs/${id}/active`, { method: 'PUT', body: { active } });
  return data.pac;
}
export async function setFormActive(id, active) {
  const data = await request(`/forms/${id}/active`, { method: 'PUT', body: { active } });
  return data.form;
}

export async function createForm(payload) {
  const data = await request('/forms', { method: 'POST', body: payload });
  return data.form;
}
export async function updateForm(id, payload) {
  const data = await request(`/forms/${id}`, { method: 'PUT', body: payload });
  return data.form;
}
export async function deleteForm(id) {
  return request(`/forms/${id}`, { method: 'DELETE' });
}

export async function inviteMember(name, username, role, password, turnoIdx = null) {
  return request('/team', { method: 'POST', body: { name, username, role, password, turnoIdx } });
}
export async function updateMember(id, role, ownedFormIds, turnoIdx = null) {
  const data = await request(`/team/${id}`, { method: 'PUT', body: { role, ownedFormIds, turnoIdx } });
  return data.member;
}
export async function deleteMember(id) {
  return request(`/team/${id}`, { method: 'DELETE' });
}
export async function resetMemberPassword(id, password) {
  return request(`/team/${id}/reset-password`, { method: 'POST', body: { password } });
}

export async function saveUnidade(payload) {
  const data = await request('/unidade', { method: 'PUT', body: payload });
  return data.unidade;
}
export async function saveTurnos(turnos) {
  const data = await request('/unidade/turnos', { method: 'PUT', body: { turnos } });
  return data.unidade;
}

export async function verifyAudit() {
  return request('/audit/verify');
}
