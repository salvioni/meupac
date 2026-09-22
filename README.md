# meuPAC — Programas de Autocontrole

Protótipo funcional de um sistema digital de **Programas de Autocontrole (PAC)** para
estabelecimentos sob inspeção do MAPA/SIF (frigoríficos, laticínios, abatedouros, entrepostos).
Substitui as planilhas de papel do controle de qualidade, com registro rastreável,
assinatura digital do operador, validação do RT e trilha de auditoria.

## Como rodar

É um **único arquivo** `meupac.html`, sem build e sem servidor.
Basta abrir `meupac.html` no navegador (Chrome/Edge/Safari/Firefox).

- Os dados ficam no navegador (localStorage) — é um protótipo, não um sistema multiusuário real.
- Bibliotecas externas usadas via CDN: Tailwind (play CDN), Google Fonts, Material Symbols e jsPDF.
  Precisa de internet na primeira carga.

## Perfis (login de demonstração)

- **Operador** (João Silva) — preenche e assina as planilhas autorizadas do seu turno.
- **Gestor / Admin** (Dra. Camila Nogueira) — valida e assina, painel, histórico, PACs e equipe.

## Principais funcionalidades

- **Operador:** fila "A fazer / Concluídas / Todas", preenchimento com validação de faixa
  (numérico) e conforme/não conforme (qualitativo), agendamento (fixos, a cada X h/min,
  X vezes, momentos do expediente, sob demanda) + dias, e histórico próprio.
- **Gestor:** painel em tempo real (não conformidades, aguardando assinatura/preenchimento,
  conformes), assinar uma/todas, histórico da fábrica com filtros e busca, gestão de PACs
  (ativar/desativar, criar/editar planilhas com controle de revisão), e gestão de equipe
  com hierarquia Admin > Gestor > Operador e permissões por planilha.
- **Rastreabilidade:** cada registro com data/hora, operador, RT, hash e "não permite edição".
- **Exportação:** PDF do registro assinado e relatório por período (PDF/CSV), com
  identificação da unidade (razão social, CNPJ, SIF, RT + CRMV, logo).
- **Dados da unidade:** cadastro editável (menu do perfil) com upload de logo.

## Estrutura

- `meupac.html` — todo o app (HTML + CSS Tailwind + JS vanilla, sem dependências locais).

## Observações / próximos passos

- Para valer em auditoria de verdade, a **inviolabilidade** e a **guarda pelo prazo**
  precisam de um **backend** (banco de dados + autenticação + assinatura real). Hoje o
  protótipo guarda tudo no navegador.
- O código está organizado em: seed de dados, helpers, telas do operador, telas do gestor,
  editor de planilha, exportação (PDF/CSV) e roteador simples.
