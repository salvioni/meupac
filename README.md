# meuPAC — Programas de Autocontrole

Sistema de **Programas de Autocontrole (PAC)** para estabelecimentos sob inspeção
do MAPA/SIF (frigoríficos, laticínios, abatedouros, entrepostos). Substitui as
planilhas de papel do controle de qualidade, com registro rastreável, login
individual, assinatura digital do operador/RT e trilha de auditoria com
integridade verificável.

## Arquitetura

O projeto foi reorganizado em duas camadas — antes era um único `meupac.html`
guardando tudo em `localStorage`, sem autenticação real e sem garantia nenhuma
de que um registro "assinado" não tinha sido editado depois.

```
backend/    API Node/Express + SQLite — dono dos dados, autenticação e hashes
frontend/   SPA em HTML/CSS (Tailwind) + JS vanilla, em módulos ES
```

### Backend (`backend/`)

- **Node.js + Express**, banco **SQLite** (`node:sqlite`, sem dependência nativa).
- **Autenticação real**: usuário/senha (bcrypt) + sessão JWT. Sem login "clique
  no card" — cada pessoa tem sua própria senha.
- **Autorização por papel**: operador só vê/preenche as planilhas atribuídas a
  ele em PACs ativos; só o gestor assina, publica planilhas, gerencia PACs,
  equipe e dados da unidade. Tudo validado no servidor, não só escondido na UI.
- **Trilha de auditoria com cadeia de hashes** (`backend/src/hash.js`): cada
  registro grava `sha256(hash_anterior + conteúdo)`, encadeando todos os
  registros da planta. Editar ou apagar um registro antigo — mesmo direto no
  banco — quebra o hash de tudo que veio depois. Isso é o que dá conteúdo real
  à promessa de "não permite edição" que a UI sempre fez. Assinaturas têm um
  segundo hash (`sign_hash`) amarrado ao hash do registro.
  Verificação: `GET /api/audit/verify` (gestor) recalcula a cadeia inteira e
  aponta onde ela quebrou, se quebrou.
- **Revisões de planilha são arquivadas**, nunca sobrescritas
  (`form_revisions`), e "excluir" um colaborador desativa a conta em vez de
  apagar (o nome dele continua correto nos registros que já assinou).

### Frontend (`frontend/`)

Mesma interface e fluxo de antes, agora em módulos ES (`frontend/src/*.js`) em
vez de um `<script>` de 1400 linhas:

```
src/
  config.js     navegação, mapa de status
  state.js      cache do estado vindo da API + helpers de consulta
  api.js        chamadas HTTP à API (fetch + token JWT)
  helpers.js    formatação, escape de HTML, toasts
  ui.js         componentes de shell/cartão reutilizados pelas telas
  pdf.js        geração de PDF/CSV (jsPDF)
  router.js     navegação entre telas + delegação de eventos de clique
  screens/      uma tela (ou grupo de telas relacionadas) por arquivo
  app.js        bootstrap (retoma sessão salva, senão mostra login)
```

Nenhuma tela grava dado direto — toda mutação (preencher, assinar, editar
planilha, mexer na equipe, dados da unidade, senha) chama a API e depois
recarrega o estado (`api.refreshState()`), então a UI nunca fica sabendo de um
dado que o servidor não confirmou.

## Como rodar

```bash
cd backend
npm install
npm start          # http://localhost:8787 — serve a API e o frontend juntos
```

O backend já serve os arquivos de `frontend/` na raiz (`/`), então não é
preciso subir os dois separadamente nem configurar CORS para uso normal.
Na primeira execução ele cria `backend/data/meupac.sqlite` e semeia os dados
de exemplo abaixo.

Variáveis de ambiente (opcionais, ver `backend/.env.example`):

- `PORT` — porta do servidor (padrão `8787`).
- `JWT_SECRET` — segredo de assinatura dos tokens. **Obrigatório em produção**
  (`NODE_ENV=production`): sem ele o servidor se recusa a iniciar. Fora de
  produção, um segredo aleatório é gerado a cada execução — funciona, mas todo
  mundo precisa logar de novo quando o servidor reinicia.
- `MEUPAC_DB` — caminho do arquivo SQLite (padrão `backend/data/meupac.sqlite`).
  Útil pra rodar uma instância de teste sem tocar nos dados reais.

## Login (dados de exemplo)

| Usuário  | Senha       | Papel               |
|----------|-------------|----------------------|
| `camila` | `meupac123` | Gestora / RT (titular) |
| `marcos` | `meupac123` | Gestor               |
| `joao`   | `meupac123` | Operador             |
| `carlos` | `meupac123` | Operador             |
| `mariana`| `meupac123` | Operador             |

Troque essas senhas (menu do perfil → Alterar senha) antes de qualquer uso
real. Novos colaboradores são criados pela tela Equipe → Convidar: o gestor
define login, senha e (para operadores) o turno, e passa os dados à pessoa.

## Principais funcionalidades

- **Operador:** fila "A fazer / Concluídas / Todas", preenchimento com
  validação de faixa (numérico, recalculada no servidor) e conforme/não
  conforme (qualitativo), agendamento (fixos, a cada X h/min, X vezes,
  momentos do expediente, sob demanda) + dias, histórico próprio.
- **Gestor:** painel em tempo real (não conformidades, aguardando
  assinatura/preenchimento, conformes), assinar uma/todas, histórico da
  fábrica com filtros e busca, gestão de PACs (ativar/desativar, criar/editar
  planilhas com controle de revisão arquivada), gestão de equipe com
  hierarquia Titular > Gestor > Operador e permissões por planilha.
- **Rastreabilidade:** cada registro com data/hora, operador, hash de
  conteúdo e (quando assinado) hash de assinatura — cadeia auditável, não
  apenas um rótulo cosmético.
- **Exportação:** PDF do registro assinado e relatório por período
  (PDF/CSV), com identificação da unidade (razão social, CNPJ, SIF, RT +
  CRMV, logo).
- **Dados da unidade:** cadastro editável (menu do perfil) com upload de logo.

## Próximos passos de hardening (antes de produção "de verdade")

- HTTPS na frente do servidor (reverse proxy) e `JWT_SECRET` forte e secreto.
- Backup periódico de `backend/data/meupac.sqlite` (ou migrar para um banco
  gerenciado, se o volume justificar).
- Política de senha (tamanho mínimo, expiração) e 2FA para contas de
  gestor/RT.
- Rate limiting no `/api/auth/login` contra força bruta.
- Migrar `bcryptjs`/`node:sqlite` (ainda experimental no Node) para versões
  estáveis conforme o ecossistema evoluir.
