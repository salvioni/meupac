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
-- cada unidade (empresa/estabelecimento) é um tenant isolado: usuários, PACs,
-- planilhas e registros de uma unidade nunca aparecem para outra.
CREATE TABLE IF NOT EXISTS unidade (
  id TEXT PRIMARY KEY,
  razao_social TEXT, marca TEXT, cnpj TEXT, sif TEXT,
  endereco TEXT, municipio TEXT, rt_nome TEXT, rt_registro TEXT, logo TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  unidade_id TEXT REFERENCES unidade(id),
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
  unidade_id TEXT REFERENCES unidade(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  norm TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  unidade_id TEXT REFERENCES unidade(id),
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
  operator_id TEXT REFERENCES users(id),
  tolerance_min INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- vínculo planilha <-> operador autorizado: uma planilha pode ter vários operadores.
-- sem nenhuma linha aqui = nenhum operador autorizado (não é "aberta a todos").
-- operator_id em forms fica só como
-- resquício de migração — a leitura/escrita de vínculo passa a ser sempre aqui.
CREATE TABLE IF NOT EXISTS form_operators (
  form_id TEXT NOT NULL REFERENCES forms(id),
  operator_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (form_id, operator_id)
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
-- prev_hash/hash formam uma cadeia (estilo blockchain) por unidade: alterar ou
-- remover um registro antigo quebra o hash de tudo que veio depois NAQUELA unidade
-- (cada empresa tem sua própria cadeia independente, isoladas entre si).
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  unidade_id TEXT REFERENCES unidade(id),
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

`);

// adiciona colunas novas em bases já existentes (CREATE TABLE IF NOT EXISTS não altera
// tabelas que já existem, então colunas criadas depois do primeiro deploy entram por aqui)
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('forms', 'tolerance_min', 'tolerance_min INTEGER NOT NULL DEFAULT 0');
ensureColumn('forms', 'active', 'active INTEGER NOT NULL DEFAULT 1');
// horário do dia ("HH:MM") que o envio cumpre, pra planilhas com vários horários
ensureColumn('submissions', 'slot', 'slot TEXT');
// quem preenche: 'um' = basta um registro por horário; 'cada' = cada pessoa com acesso envia o seu
ensureColumn('forms', 'fill_mode', "fill_mode TEXT NOT NULL DEFAULT 'um'");
// turnos do expediente da unidade: [{ inicio, fim, ativo }] (null = padrão de schedule.js)
ensureColumn('unidade', 'turnos_json', 'turnos_json TEXT');
// turno de cada pessoa: 0 = 1º, 1 = 2º, NULL = ambos. Na criação da coluna, aproveita
// o texto livre antigo ("Turno Manhã"/"Turno Tarde") — só dessa vez, pra não desfazer
// depois uma escolha de "ambos".
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'turno_idx')) {
  db.exec('ALTER TABLE users ADD COLUMN turno_idx INTEGER');
  db.exec("UPDATE users SET turno_idx = 0 WHERE turno LIKE '%manh%'");
  db.exec("UPDATE users SET turno_idx = 1 WHERE turno LIKE '%tarde%'");
}
ensureColumn('pacs', 'description', 'description TEXT');
ensureColumn('users', 'unidade_id', 'unidade_id TEXT');
ensureColumn('pacs', 'unidade_id', 'unidade_id TEXT');
ensureColumn('forms', 'unidade_id', 'unidade_id TEXT');
ensureColumn('submissions', 'unidade_id', 'unidade_id TEXT');

// migração única: bases antigas tinham uma única unidade fixa (id=1, sem suporte
// a mais de uma empresa). Se detectar esse formato antigo, recria a tabela sem a
// trava de "uma unidade só" e preserva os dados existentes sob um novo id.
function migrateUnidadeTable() {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='unidade'`).get();
  if (!row || !/CHECK\s*\(\s*id\s*=\s*1\s*\)/i.test(row.sql)) return;
  const newId = 'un' + Date.now() + Math.random().toString(36).slice(2, 7);
  db.exec('ALTER TABLE unidade RENAME TO unidade_old_singletenant;');
  db.exec(`CREATE TABLE unidade (
    id TEXT PRIMARY KEY,
    razao_social TEXT, marca TEXT, cnpj TEXT, sif TEXT,
    endereco TEXT, municipio TEXT, rt_nome TEXT, rt_registro TEXT, logo TEXT
  );`);
  const old = db.prepare('SELECT * FROM unidade_old_singletenant WHERE id = 1').get();
  if (old) {
    db.prepare(`INSERT INTO unidade (id,razao_social,marca,cnpj,sif,endereco,municipio,rt_nome,rt_registro,logo) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(newId, old.razao_social, old.marca, old.cnpj, old.sif, old.endereco, old.municipio, old.rt_nome, old.rt_registro, old.logo);
  }
  db.exec('DROP TABLE unidade_old_singletenant;');
}
migrateUnidadeTable();

// carimba unidade_id em linhas antigas (de antes do multi-empresa) com a única
// unidade que existia até então — não roda nada se o banco ainda estiver vazio
// (aí quem carimba é o próprio seed/cadastro, que já nasce com o id certo).
function backfillUnidadeId() {
  const u = db.prepare('SELECT id FROM unidade LIMIT 1').get();
  if (!u) return;
  db.prepare('UPDATE users SET unidade_id = ? WHERE unidade_id IS NULL').run(u.id);
  db.prepare('UPDATE pacs SET unidade_id = ? WHERE unidade_id IS NULL').run(u.id);
  db.prepare('UPDATE forms SET unidade_id = ? WHERE unidade_id IS NULL').run(u.id);
  db.prepare('UPDATE submissions SET unidade_id = ? WHERE unidade_id IS NULL').run(u.id);
}

// os 15 PACs padrão (RIISPOA) — fonte única de verdade, tanto pro seed de demonstração
// quanto pro cadastro de uma unidade nova (cada unidade recebe sua PRÓPRIA cópia,
// com ids distintos, pra poder ativar/desativar cada PAC independente das outras).
export const PAC_TEMPLATES = [
  { code: 'PAC 01', name: 'Manutenção', icon: 'build', norm: 'RIISPOA · Dec. 9.013/2017', description: 'Cobre a manutenção preventiva e corretiva de instalações, equipamentos e utensílios, garantindo que seu estado de conservação não comprometa a segurança e a qualidade dos produtos. Deve conter cronograma de manutenções, registros de execução e ações corretivas quando alguma falha afeta a produção.' },
  { code: 'PAC 02', name: 'Água de Abastecimento', icon: 'water_drop', norm: 'Portaria Consolidação MS nº 5/2017', description: 'Cobre a potabilidade da água usada na indústria — captação, tratamento, reservação e distribuição. Deve conter o controle periódico de cloro residual, pH e potabilidade microbiológica, além do registro de limpeza dos reservatórios.' },
  { code: 'PAC 03', name: 'Controle Integrado de Pragas', icon: 'pest_control', norm: 'RIISPOA · NI 01/2017', description: 'Cobre a prevenção e o controle de vetores e pragas urbanas (insetos, roedores) que possam contaminar produtos, instalações ou embalagens. Deve conter mapa de armadilhas e iscas, frequência de inspeção e registro de ocorrências e ações de controle.' },
  { code: 'PAC 04', name: 'Higiene Industrial e Operacional', icon: 'cleaning_services', norm: 'PPHO · RIISPOA', description: 'Cobre a limpeza e a sanitização de instalações, equipamentos e utensílios antes, durante e depois da operação. Deve conter os procedimentos de higienização, os produtos usados e a verificação de eficácia (visual ou analítica).' },
  { code: 'PAC 05', name: 'Higiene e Hábitos dos Funcionários', icon: 'clean_hands', norm: 'RIISPOA', description: 'Cobre a higiene pessoal, o vestuário e as barreiras sanitárias dos colaboradores que manipulam produtos. Deve conter a verificação de uniformes, higienização das mãos, pediluvio e demais barreiras de entrada.' },
  { code: 'PAC 06', name: 'Procedimento Sanitário Operacional (PSO)', icon: 'wash', norm: 'RIISPOA', description: 'Cobre a higiene das superfícies de contato direto com o produto, verificada imediatamente antes do início e durante a produção. Deve conter a inspeção pré-operacional de mesas, esteiras e utensílios que tocam o produto.' },
  { code: 'PAC 07', name: 'Matéria-Prima, Ingredientes e Embalagens', icon: 'inventory_2', norm: 'RIISPOA', description: 'Cobre o recebimento e a procedência de matérias-primas, ingredientes e materiais de embalagem. Deve conter a verificação das condições sanitárias e da documentação de cada lote recebido antes da liberação para uso.' },
  { code: 'PAC 08', name: 'Controle de Temperatura', icon: 'thermostat', norm: 'RIISPOA Art. 143', description: 'Cobre a cadeia do frio do produto — câmaras de resfriamento, congelamento e transporte. Deve conter o monitoramento periódico das temperaturas e a calibração dos termômetros usados na medição.' },
  { code: 'PAC 09', name: 'APPCC', icon: 'checklist', norm: 'Portaria MAPA nº 46/1998', description: 'Cobre a Análise de Perigos e Pontos Críticos de Controle do processo produtivo. Deve conter a identificação dos pontos críticos, os limites críticos definidos e o monitoramento de cada um deles.' },
  { code: 'PAC 10', name: 'Análises Laboratoriais', icon: 'science', norm: 'RIISPOA', description: 'Cobre a coleta e análise de amostras microbiológicas e físico-químicas de produtos, água e ambiente. Deve conter o plano de amostragem, os laudos obtidos e as ações tomadas em caso de resultado fora do padrão.' },
  { code: 'PAC 11', name: 'Formulação de Produtos e Combate à Fraude', icon: 'fact_check', norm: 'RIISPOA', description: 'Cobre a conformidade da formulação e da rotulagem dos produtos frente ao que é declarado. Deve conter a verificação de ingredientes usados e ações de prevenção contra adulteração ou fraude.' },
  { code: 'PAC 12', name: 'Recolhimento e Rastreabilidade', icon: 'qr_code_2', norm: 'RIISPOA', description: 'Cobre a capacidade de rastrear um produto do recebimento da matéria-prima até a expedição. Deve conter o sistema de identificação de lotes e o procedimento de recolhimento (recall) em caso de não conformidade.' },
  { code: 'PAC 13', name: 'Respaldo para Certificação Oficial', icon: 'workspace_premium', norm: 'RIISPOA', description: 'Cobre a documentação e os registros que dão suporte à emissão de certificados sanitários oficiais pela inspeção federal/estadual. Deve conter os documentos que comprovam a conformidade do processo e do produto certificado.' },
  { code: 'PAC 14', name: 'Bem-estar Animal', icon: 'pets', norm: 'IN MAPA · RIISPOA', description: 'Cobre o manejo, o transporte e o abate humanitário dos animais. Deve conter a verificação das condições de embarque/desembarque, descanso, condução e insensibilização.' },
  { code: 'PAC 15', name: 'Material Especificado de Risco (MER)', icon: 'dangerous', norm: 'IN SDA nº 12/2004', description: 'Cobre a identificação, segregação e destinação de materiais especificados de risco para encefalopatia espongiforme bovina (EEB). Deve conter o registro de retirada e a destinação final dada a cada material segregado.' },
];

// cria os 15 PACs padrão pra uma unidade. fixedIds preserva os ids literais 'pac01'..'pac15'
// usados pelo seed de demonstração (as planilhas de exemplo referenciam esses ids
// diretamente); um cadastro novo não passa fixedIds e recebe ids únicos gerados na hora.
export function seedPacsFor(unidadeId, fixedIds) {
  const insPac = db.prepare('INSERT INTO pacs (id,unidade_id,code,name,icon,norm,description,active) VALUES (?,?,?,?,?,?,?,1)');
  return PAC_TEMPLATES.map((t, i) => {
    const id = (fixedIds && fixedIds[i]) || ('pac' + Date.now() + Math.random().toString(36).slice(2, 6) + i);
    insPac.run(id, unidadeId, t.code, t.name, t.icon, t.norm, t.description);
    return id;
  });
}

// preenche a descrição dos PACs padrão em bases já existentes (o seed só roda em
// banco vazio, então quem já tinha dados fica sem essas descrições sem isso aqui)
function backfillPacDescriptions() {
  const upd = db.prepare('UPDATE pacs SET description = ? WHERE code = ? AND description IS NULL');
  PAC_TEMPLATES.forEach(t => upd.run(t.description, t.code));
}

// migração única: bases antigas guardavam o vínculo em forms.operator_id (1 operador por
// planilha); a partir daqui o vínculo mora em form_operators (N operadores por planilha).
// Depois de copiado, operator_id é zerado — assim isso não roda de novo a cada boot.
function migrateFormOperators() {
  const legacy = db.prepare('SELECT id, operator_id FROM forms WHERE operator_id IS NOT NULL').all();
  if (!legacy.length) return;
  const insOp = db.prepare('INSERT OR IGNORE INTO form_operators (form_id, operator_id) VALUES (?, ?)');
  legacy.forEach(f => insOp.run(f.id, f.operator_id));
  db.prepare('UPDATE forms SET operator_id = NULL WHERE operator_id IS NOT NULL').run();
}

// migração única: planilhas com frequência sem horário fixo (a cada X horas, momentos,
// N vezes, sob demanda) não devem ter "due" — um valor antigo ali fazia o painel mostrar
// "às 09:00" pra uma planilha "a cada 2 horas". Idempotente: só toca quem ainda tem due.
function clearStaleDue() {
  db.prepare(`UPDATE forms SET due = '' WHERE due != '' AND schedule_json IS NOT NULL
    AND json_extract(schedule_json, '$.type') IS NOT NULL AND json_extract(schedule_json, '$.type') != 'fixos'`).run();
}

function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (count > 0) return;

  const now = new Date();
  const isoAt = (dayOffset, h, m) => { const d = new Date(now); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const unidadeId = 'un_demo';
  db.prepare(`INSERT INTO unidade (id,razao_social,marca,cnpj,sif,endereco,municipio,rt_nome,rt_registro,logo) VALUES (?,?,?,?,?,?,?,?,?,NULL)`)
    .run(unidadeId, 'Frigorífico Serra Verde Ltda.', 'Serra Verde', '12.345.678/0001-90', 'SIF 4412', 'Rod. BR-262, km 12 — Zona Rural', 'Serra Verde/MG', 'Dra. Camila Nogueira', 'CRMV-SP 14.892');

  const insUser = db.prepare(`INSERT INTO users (id,unidade_id,name,username,password_hash,role,titular,cargo,turno,matricula,initials,color,ink,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  insUser.run('u_camila', unidadeId, 'Dra. Camila Nogueira', 'camila', hash('meupac123'), 'gerente', 1, 'RT · CRMV 14.892', null, null, 'CN', '#0f2642', '#ffffff');
  insUser.run('u_joao', unidadeId, 'João Silva', 'joao', hash('meupac123'), 'operador', 0, null, 'Turno Manhã', '#4082', 'JS', '#b2c8eb', '#0f2642');
  insUser.run('u_marcos', unidadeId, 'Marcos Andrade', 'marcos', hash('meupac123'), 'gerente', 0, 'Supervisor de Qualidade', null, null, 'MA', '#dfe9fb', '#0f2642');
  insUser.run('u_carlos', unidadeId, 'Carlos Mendes', 'carlos', hash('meupac123'), 'operador', 0, null, 'Turno Tarde', null, 'CM', '#88d7ab', '#0d5537');
  insUser.run('u_mariana', unidadeId, 'Mariana Rocha', 'mariana', hash('meupac123'), 'operador', 0, null, 'Turno Manhã', null, 'MR', '#ffb77d', '#6e3900');
  db.prepare("UPDATE users SET turno_idx = CASE WHEN turno LIKE '%manh%' THEN 0 WHEN turno LIKE '%tarde%' THEN 1 END WHERE unidade_id = ?").run(unidadeId);

  seedPacsFor(unidadeId, ['pac01', 'pac02', 'pac03', 'pac04', 'pac05', 'pac06', 'pac07', 'pac08', 'pac09', 'pac10', 'pac11', 'pac12', 'pac13', 'pac14', 'pac15']);

  const insForm = db.prepare(`INSERT INTO forms (id,unidade_id,pac_id,pl_num,rev,rev_date,title,due,schedule_json,days_json,times_json,location,sector,default_status,params_json,operator_id)
    VALUES (?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?)`);
  const revDate = isoAt(-30, 8, 0);
  insForm.run('f_agua', unidadeId, 'pac02', 1, revDate, 'Cloro e pH da Água', '', JSON.stringify({ type: 'intervalo', every: 2, unit: 'horas' }), null, null, 'Ponto 02 · Saída do Reservatório Central', 'Setor 04', 'atrasado',
    JSON.stringify([{ id: 'p_cl', type: 'numeric', name: 'Cloro Livre', unit: 'ppm', min: 0.5, max: 2.0, step: 0.1, seed: 1.8 },
      { id: 'p_ph', type: 'numeric', name: 'pH da Água', unit: 'pH', min: 6.0, max: 7.5, step: 0.1, seed: 7.2 },
      { id: 'p_asp', type: 'qualitative', name: 'Aspecto Sensorial', good: 'Límpida e Inodora' }]), 'u_joao');
  insForm.run('f_res', unidadeId, 'pac02', 2, revDate, 'Limpeza dos Reservatórios', '07:30', null, null, null, 'Reservatório Central (50.000L)', 'Setor 04', 'concluido',
    JSON.stringify([{ id: 'p_lav', type: 'qualitative', name: 'Lavagem e Desinfecção', good: 'Realizada' }, { id: 'p_vis', type: 'qualitative', name: 'Inspeção Visual Interna', good: 'Sem resíduos' }]), 'u_joao');
  insForm.run('f_hig', unidadeId, 'pac04', 1, revDate, 'Higienização Pré-Operacional', '', JSON.stringify({ type: 'momentos', moments: ['inicio'] }), null, null, 'Esteiras e mesas de processamento', 'Bloco B', 'pendente',
    JSON.stringify([{ id: 'p_est', type: 'qualitative', name: 'Esteiras Sanitizadas', good: 'Conforme' }, { id: 'p_mes', type: 'qualitative', name: 'Mesas de Corte', good: 'Conforme' }, { id: 'p_utn', type: 'qualitative', name: 'Utensílios', good: 'Conforme' }]), 'u_joao');
  insForm.run('f_pias', unidadeId, 'pac04', 2, revDate, 'Higienização de Pias e Vestiários', '12:00', null, null, null, 'Vestiários e lavatórios', 'Bloco A', 'agendado',
    JSON.stringify([{ id: 'p_sab', type: 'qualitative', name: 'Reposição de Sabonete', good: 'Abastecido' }, { id: 'p_pap', type: 'qualitative', name: 'Papel Toalha', good: 'Abastecido' }]), 'u_joao');
  insForm.run('f_cam', unidadeId, 'pac08', 1, revDate, 'Temperatura de Câmaras Frias', '', JSON.stringify({ type: 'intervalo', every: 2, unit: 'horas' }), null, null, 'Câmaras de estocagem 01 e 03', 'Cadeia do Frio', 'afazer',
    JSON.stringify([{ id: 'p_c1', type: 'numeric', name: 'Câmara 01', unit: '°C', min: -1.0, max: 4.0, step: 0.1, seed: 2.1 }, { id: 'p_c3', type: 'numeric', name: 'Câmara 03', unit: '°C', min: -1.0, max: 4.0, step: 0.1, seed: 3.4 }]), 'u_carlos');
  insForm.run('f_term', unidadeId, 'pac08', 2, revDate, 'Verificação de Termômetros', '07:00', null, null, null, 'Sensores da cadeia do frio', 'Cadeia do Frio', 'concluido',
    JSON.stringify([{ id: 'p_cal', type: 'qualitative', name: 'Calibração conferida', good: 'Conforme' }]), 'u_carlos');
  insForm.run('f_bar', unidadeId, 'pac05', 1, revDate, 'Inspeção de Barreira e Uniformes', '', JSON.stringify({ type: 'momentos', moments: ['inicio'] }), null, null, 'Barreira sanitária de entrada', 'Bloco A', 'concluido',
    JSON.stringify([{ id: 'p_uni', type: 'qualitative', name: 'Uniformes Completos', good: 'Conforme' }, { id: 'p_ped', type: 'qualitative', name: 'Pedilúvio Abastecido', good: 'Conforme' }]), 'u_mariana');
  insForm.run('f_prag', unidadeId, 'pac03', 1, revDate, 'Monitoramento de Armadilhas e Iscas', '10:00', null, null, null, 'Perímetro e docas', 'Externo', 'afazer',
    JSON.stringify([{ id: 'p_arm', type: 'qualitative', name: 'Armadilhas Íntegras', good: 'Conforme' }, { id: 'p_isc', type: 'qualitative', name: 'Iscas Verificadas', good: 'Conforme' }]), 'u_mariana');

  let seq = 0, prevHash = null;
  const insSub = db.prepare(`INSERT INTO submissions (id,unidade_id,form_id,operator_id,operator_name,ts,values_json,conforme,occurrence_json,note,signed_by,signed_at,prev_hash,hash,sign_hash,seq) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const addSub = (id, formId, operatorId, operatorName, ts, values, conforme, occurrence, note, signedBy, signedAt) => {
    seq += 1;
    const payload = { formId, operatorId, operatorName, ts, values, conforme, occurrence: occurrence || null, note: note || '' };
    const h = recordHash(prevHash, payload);
    const sh = signedBy ? signatureHash(h, signedBy, signedAt) : null;
    insSub.run(id, unidadeId, formId, operatorId, operatorName, ts, JSON.stringify(values), conforme ? 1 : 0, occurrence ? JSON.stringify(occurrence) : null, note || '', signedBy || null, signedAt || null, prevHash, h, sh, seq);
    prevHash = h;
  };
  addSub('s1', 'f_res', 'u_joao', 'João Silva', isoAt(0, 7, 30), { p_lav: { ok: true, val: 'Realizada' }, p_vis: { ok: true, val: 'Sem resíduos' } }, true, null, '', 'Dra. Camila Nogueira', isoAt(0, 7, 45));
  addSub('s2', 'f_term', 'u_carlos', 'Carlos Mendes', isoAt(0, 7, 0), { p_cal: { ok: true, val: 'Conforme' } }, true, null, '', 'Dra. Camila Nogueira', isoAt(0, 8, 15));
  addSub('s3', 'f_bar', 'u_mariana', 'Mariana Rocha', isoAt(0, 6, 0), { p_uni: { ok: true, val: 'Conforme' }, p_ped: { ok: true, val: 'Conforme' } }, true, null, '', null, null);
  addSub('s4', 'f_cam', 'u_carlos', 'Carlos Mendes', isoAt(0, 10, 30), { p_c1: { ok: true, val: '2.1 °C', num: 2.1 }, p_c3: { ok: false, val: '4.8 °C', num: 4.8 } }, false, { issues: ['Câmara 03: 4.8 °C (faixa -1–4)'], note: 'Portas seladas, carcaças sob quarentena.' }, '', null, null);
}

seedIfEmpty();
migrateFormOperators();
clearStaleDue();
backfillPacDescriptions();
backfillUnidadeId();
