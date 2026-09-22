import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { recordHash, signatureHash } from './hash.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.MEUPAC_DB || join(dataDir, 'meupac.sqlite');
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('operador','gerente')),
  titular INTEGER NOT NULL DEFAULT 0,
  cargo TEXT,
  turno TEXT,
  matricula TEXT,
  initials TEXT,
  color TEXT,
  ink TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS pacs (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  norm TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  pac_id TEXT NOT NULL REFERENCES pacs(id),
  pl_num INTEGER NOT NULL,
  rev INTEGER NOT NULL DEFAULT 1,
  rev_date TEXT,
  title TEXT NOT NULL,
  due TEXT,
  schedule_json TEXT,
  days_json TEXT,
  times_json TEXT,
  location TEXT,
  sector TEXT,
  default_status TEXT,
  params_json TEXT NOT NULL,
  operator_id TEXT REFERENCES users(id)
);

-- revisões arquivadas: publicar uma edição empilha aqui a versão anterior (nunca é apagada)
CREATE TABLE IF NOT EXISTS form_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id TEXT NOT NULL REFERENCES forms(id),
  rev INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  archived_at TEXT NOT NULL
);

-- append-only: nenhuma rota de UPDATE/DELETE existe para os campos de medição.
-- prev_hash/hash formam uma cadeia (estilo blockchain) sobre toda a planta:
-- alterar ou remover um registro antigo quebra o hash de tudo que veio depois.
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id),
  operator_id TEXT NOT NULL REFERENCES users(id),
  operator_name TEXT NOT NULL,
  ts TEXT NOT NULL,
  values_json TEXT NOT NULL,
  conforme INTEGER NOT NULL,
  occurrence_json TEXT,
  note TEXT,
  signed_by TEXT,
  signed_at TEXT,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  sign_hash TEXT,
  seq INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS unidade (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  razao_social TEXT, marca TEXT, cnpj TEXT, sif TEXT,
  endereco TEXT, municipio TEXT, rt_nome TEXT, rt_registro TEXT, logo TEXT
);

CREATE TABLE IF NOT EXISTS plant (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT
);
`);

function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (count > 0) return;

  const now = new Date();
  const isoAt = (dayOffset, h, m) => { const d = new Date(now); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const insUser = db.prepare(`INSERT INTO users (id,name,username,password_hash,role,titular,cargo,turno,matricula,initials,color,ink,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  insUser.run('u_camila', 'Dra. Camila Nogueira', 'camila', hash('meupac123'), 'gerente', 1, 'RT · CRMV 14.892', null, null, 'CN', '#0f2642', '#ffffff');
  insUser.run('u_joao', 'João Silva', 'joao', hash('meupac123'), 'operador', 0, null, 'Turno Manhã', '#4082', 'JS', '#b2c8eb', '#0f2642');
  insUser.run('u_marcos', 'Marcos Andrade', 'marcos', hash('meupac123'), 'gerente', 0, 'Supervisor de Qualidade', null, null, 'MA', '#dfe9fb', '#0f2642');
  insUser.run('u_carlos', 'Carlos Mendes', 'carlos', hash('meupac123'), 'operador', 0, null, 'Turno Tarde', null, 'CM', '#88d7ab', '#0d5537');
  insUser.run('u_mariana', 'Mariana Rocha', 'mariana', hash('meupac123'), 'operador', 0, null, 'Turno Manhã', null, 'MR', '#ffb77d', '#6e3900');

  db.prepare('INSERT INTO plant (id, name) VALUES (1, ?)').run('Frigorífico Serra Verde — SIF 4412');
  db.prepare(`INSERT INTO unidade (id,razao_social,marca,cnpj,sif,endereco,municipio,rt_nome,rt_registro,logo) VALUES (1,?,?,?,?,?,?,?,?,NULL)`)
    .run('Frigorífico Serra Verde Ltda.', 'Serra Verde', '12.345.678/0001-90', 'SIF 4412', 'Rod. BR-262, km 12 — Zona Rural', 'Serra Verde/MG', 'Dra. Camila Nogueira', 'CRMV-SP 14.892');

  const pacs = [
    ['pac01', 'PAC 01', 'Manutenção', 'build', 'RIISPOA · Dec. 9.013/2017'],
    ['pac02', 'PAC 02', 'Água de Abastecimento', 'water_drop', 'Portaria Consolidação MS nº 5/2017'],
    ['pac03', 'PAC 03', 'Controle Integrado de Pragas', 'pest_control', 'RIISPOA · NI 01/2017'],
    ['pac04', 'PAC 04', 'Higiene Industrial e Operacional', 'cleaning_services', 'PPHO · RIISPOA'],
    ['pac05', 'PAC 05', 'Higiene e Hábitos dos Funcionários', 'clean_hands', 'RIISPOA'],
    ['pac06', 'PAC 06', 'Procedimento Sanitário Operacional (PSO)', 'wash', 'RIISPOA'],
    ['pac07', 'PAC 07', 'Matéria-Prima, Ingredientes e Embalagens', 'inventory_2', 'RIISPOA'],
    ['pac08', 'PAC 08', 'Controle de Temperatura', 'thermostat', 'RIISPOA Art. 143'],
    ['pac09', 'PAC 09', 'APPCC', 'checklist', 'Portaria MAPA nº 46/1998'],
    ['pac10', 'PAC 10', 'Análises Laboratoriais', 'science', 'RIISPOA'],
    ['pac11', 'PAC 11', 'Formulação de Produtos e Combate à Fraude', 'fact_check', 'RIISPOA'],
    ['pac12', 'PAC 12', 'Recolhimento e Rastreabilidade', 'qr_code_2', 'RIISPOA'],
    ['pac13', 'PAC 13', 'Respaldo para Certificação Oficial', 'workspace_premium', 'RIISPOA'],
    ['pac14', 'PAC 14', 'Bem-estar Animal', 'pets', 'IN MAPA · RIISPOA'],
    ['pac15', 'PAC 15', 'Material Especificado de Risco (MER)', 'dangerous', 'IN SDA nº 12/2004'],
  ];
  const insPac = db.prepare('INSERT INTO pacs (id,code,name,icon,norm,active) VALUES (?,?,?,?,?,1)');
  pacs.forEach(p => insPac.run(...p));

  const insForm = db.prepare(`INSERT INTO forms (id,pac_id,pl_num,rev,rev_date,title,due,schedule_json,days_json,times_json,location,sector,default_status,params_json,operator_id)
    VALUES (?,?,?,1,?,?,?,?,?,?,?,?,?,?,?)`);
  const revDate = isoAt(-30, 8, 0);
  insForm.run('f_agua', 'pac02', 1, revDate, 'Cloro e pH da Água', '09:00', JSON.stringify({ type: 'intervalo', every: 2, unit: 'horas' }), null, null, 'Ponto 02 · Saída do Reservatório Central', 'Setor 04', 'atrasado',
    JSON.stringify([{ id: 'p_cl', type: 'numeric', name: 'Cloro Livre', unit: 'ppm', min: 0.5, max: 2.0, step: 0.1, seed: 1.8 },
      { id: 'p_ph', type: 'numeric', name: 'pH da Água', unit: 'pH', min: 6.0, max: 7.5, step: 0.1, seed: 7.2 },
      { id: 'p_asp', type: 'qualitative', name: 'Aspecto Sensorial', good: 'Límpida e Inodora' }]), 'u_joao');
  insForm.run('f_res', 'pac02', 2, revDate, 'Limpeza dos Reservatórios', '07:30', null, null, null, 'Reservatório Central (50.000L)', 'Setor 04', 'concluido',
    JSON.stringify([{ id: 'p_lav', type: 'qualitative', name: 'Lavagem e Desinfecção', good: 'Realizada' }, { id: 'p_vis', type: 'qualitative', name: 'Inspeção Visual Interna', good: 'Sem resíduos' }]), 'u_joao');
  insForm.run('f_hig', 'pac04', 1, revDate, 'Higienização Pré-Operacional', '11:00', JSON.stringify({ type: 'momentos', moments: ['inicio'] }), null, null, 'Esteiras e mesas de processamento', 'Bloco B', 'pendente',
    JSON.stringify([{ id: 'p_est', type: 'qualitative', name: 'Esteiras Sanitizadas', good: 'Conforme' }, { id: 'p_mes', type: 'qualitative', name: 'Mesas de Corte', good: 'Conforme' }, { id: 'p_utn', type: 'qualitative', name: 'Utensílios', good: 'Conforme' }]), 'u_joao');
  insForm.run('f_pias', 'pac04', 2, revDate, 'Higienização de Pias e Vestiários', '12:00', null, null, null, 'Vestiários e lavatórios', 'Bloco A', 'agendado',
    JSON.stringify([{ id: 'p_sab', type: 'qualitative', name: 'Reposição de Sabonete', good: 'Abastecido' }, { id: 'p_pap', type: 'qualitative', name: 'Papel Toalha', good: 'Abastecido' }]), 'u_joao');
  insForm.run('f_cam', 'pac08', 1, revDate, 'Temperatura de Câmaras Frias', '14:00', JSON.stringify({ type: 'intervalo', every: 2, unit: 'horas' }), null, null, 'Câmaras de estocagem 01 e 03', 'Cadeia do Frio', 'afazer',
    JSON.stringify([{ id: 'p_c1', type: 'numeric', name: 'Câmara 01', unit: '°C', min: -1.0, max: 4.0, step: 0.1, seed: 2.1 }, { id: 'p_c3', type: 'numeric', name: 'Câmara 03', unit: '°C', min: -1.0, max: 4.0, step: 0.1, seed: 3.4 }]), 'u_carlos');
  insForm.run('f_term', 'pac08', 2, revDate, 'Verificação de Termômetros', '07:00', null, null, null, 'Sensores da cadeia do frio', 'Cadeia do Frio', 'concluido',
    JSON.stringify([{ id: 'p_cal', type: 'qualitative', name: 'Calibração conferida', good: 'Conforme' }]), 'u_carlos');
  insForm.run('f_bar', 'pac05', 1, revDate, 'Inspeção de Barreira e Uniformes', '06:00', JSON.stringify({ type: 'momentos', moments: ['inicio'] }), null, null, 'Barreira sanitária de entrada', 'Bloco A', 'concluido',
    JSON.stringify([{ id: 'p_uni', type: 'qualitative', name: 'Uniformes Completos', good: 'Conforme' }, { id: 'p_ped', type: 'qualitative', name: 'Pedilúvio Abastecido', good: 'Conforme' }]), 'u_mariana');
  insForm.run('f_prag', 'pac03', 1, revDate, 'Monitoramento de Armadilhas e Iscas', '10:00', null, null, null, 'Perímetro e docas', 'Externo', 'afazer',
    JSON.stringify([{ id: 'p_arm', type: 'qualitative', name: 'Armadilhas Íntegras', good: 'Conforme' }, { id: 'p_isc', type: 'qualitative', name: 'Iscas Verificadas', good: 'Conforme' }]), 'u_mariana');

  let seq = 0, prevHash = null;
  const insSub = db.prepare(`INSERT INTO submissions (id,form_id,operator_id,operator_name,ts,values_json,conforme,occurrence_json,note,signed_by,signed_at,prev_hash,hash,sign_hash,seq) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const addSub = (id, formId, operatorId, operatorName, ts, values, conforme, occurrence, note, signedBy, signedAt) => {
    seq += 1;
    const payload = { formId, operatorId, operatorName, ts, values, conforme, occurrence: occurrence || null, note: note || '' };
    const h = recordHash(prevHash, payload);
    const sh = signedBy ? signatureHash(h, signedBy, signedAt) : null;
    insSub.run(id, formId, operatorId, operatorName, ts, JSON.stringify(values), conforme ? 1 : 0, occurrence ? JSON.stringify(occurrence) : null, note || '', signedBy || null, signedAt || null, prevHash, h, sh, seq);
    prevHash = h;
  };
  addSub('s1', 'f_res', 'u_joao', 'João Silva', isoAt(0, 7, 30), { p_lav: { ok: true, val: 'Realizada' }, p_vis: { ok: true, val: 'Sem resíduos' } }, true, null, '', 'Dra. Camila Nogueira', isoAt(0, 7, 45));
  addSub('s2', 'f_term', 'u_carlos', 'Carlos Mendes', isoAt(0, 7, 0), { p_cal: { ok: true, val: 'Conforme' } }, true, null, '', 'Dra. Camila Nogueira', isoAt(0, 8, 15));
  addSub('s3', 'f_bar', 'u_mariana', 'Mariana Rocha', isoAt(0, 6, 0), { p_uni: { ok: true, val: 'Conforme' }, p_ped: { ok: true, val: 'Conforme' } }, true, null, '', null, null);
  addSub('s4', 'f_cam', 'u_carlos', 'Carlos Mendes', isoAt(0, 10, 30), { p_c1: { ok: true, val: '2.1 °C', num: 2.1 }, p_c3: { ok: false, val: '4.8 °C', num: 4.8 } }, false, { issues: ['Câmara 03: 4.8 °C (faixa -1–4)'], note: 'Portas seladas, carcaças sob quarentena.' }, '', null, null);
}

seedIfEmpty();
