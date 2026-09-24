import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db } from './db.js';

import { authRouter } from './routes/auth.js';
import { stateRouter } from './routes/state.js';
import { submissionsRouter } from './routes/submissions.js';
import { formsRouter } from './routes/forms.js';
import { pacsRouter } from './routes/pacs.js';
import { teamRouter } from './routes/team.js';
import { unidadeRouter } from './routes/unidade.js';
import { auditRouter } from './routes/audit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, '..', '..', 'frontend');

const app = express();
// em produção roda atrás do proxy do Render: req.ip vem do X-Forwarded-For
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '3mb' }));

// health check (Render): confirma que o servidor responde e o banco abre
app.get('/api/health', (req, res) => {
  try { db.prepare('SELECT 1').get(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false }); }
});

app.use('/api/auth', authRouter);
app.use('/api/state', stateRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/forms', formsRouter);
app.use('/api/pacs', pacsRouter);
app.use('/api/team', teamRouter);
app.use('/api/unidade', unidadeRouter);
app.use('/api/audit', auditRouter);

// a raiz é a landing page de marketing (fora do app); o app em si mora em /app
// e em qualquer outra rota de cliente — nenhuma delas é um arquivo real no disco.
app.get('/', (req, res) => {
  res.sendFile(join(frontendDir, 'landing.html'));
});

app.use(express.static(frontendDir));
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(join(frontendDir, 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`meuPAC backend rodando em http://localhost:${PORT}`);
});
