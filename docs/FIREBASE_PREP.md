# Preparacao Firebase

## Primeira etapa online

O modo online atual e uma sala de teste com Firebase Realtime Database.

- Host cria um codigo de sala.
- Guest entra pelo codigo.
- Cada cliente publica posicao, mira, arma, vida/ativo e estado de bomba do proprio player.
- Os outros clientes aparecem como avatares remotos visuais.
- O host publica um snapshot oficial de partida em `rooms/{roomCode}/match`.
- O guest renderiza o snapshot oficial do host.
- O guest ainda nao envia input para controlar um personagem na simulacao do host.

## Estado local por enquanto

- Simulacao da bomba.
- Timer da rodada.
- Eliminacoes.
- Spawn de armas.
- IA dos bots.
- Colisao da arena.
- Audio e cutscene.

## Estado online atual

- Sala.
- Host.
- Presenca de jogadores.
- Snapshot visual do jogador.
- Snapshot oficial do host com players, bomba e rodada.

## Proxima migracao

1. Guests enviam input/intencao para `rooms/{roomCode}/inputs/{playerId}`.
2. Host cria players remotos reais a partir desses inputs.
3. Host inclui tiros, armas e eliminacoes dos guests no snapshot oficial.
4. Ranking usa uma colecao separada de resultados apos autenticacao.

## Regras

`firebase/database.rules.json` esta aberto para teste local. Antes de publicar, trocar para regras com Auth/App Check.
