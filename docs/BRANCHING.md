# Branching

Este repositorio usa branches por area de responsabilidade.

## `main`

Branch de integracao. Deve receber apenas mudancas ja validadas das branches de trabalho.

Uso esperado:

- estrutura base do projeto;
- documentacao compartilhada;
- merges de entregas estaveis.

## `frontend`

Branch para o cliente web.

Uso esperado:

- Vite;
- TypeScript;
- Phaser;
- cenas;
- entidades;
- sistemas de movimento, dash, bomba e HUD.

## `backend`

Branch para servidor e multiplayer.

Uso esperado:

- Node.js;
- WebSocket;
- salas;
- autoridade do servidor;
- sincronizacao;
- timer e eliminacoes no servidor.

## `QA`

Branch para qualidade e verificacao.

Uso esperado:

- planos de teste;
- testes automatizados;
- fixtures;
- scripts de validacao;
- checklists de balanceamento e regressao.

## Fluxo sugerido

1. Criar ou editar na branch da area correta.
2. Rodar a verificacao adequada.
3. Integrar em `main` quando estiver estavel.

