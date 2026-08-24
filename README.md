# Bomb Tag

Party game competitivo de navegador: 8 jogadores entram, 1 sai.

O foco inicial do projeto e provar o nucleo de game feel:

```text
movimento -> mira -> dash -> lancamento -> ricochete -> retorno da bomba
```

## Estrutura

```text
frontend/   Cliente web com TypeScript, Phaser e Vite.
backend/    Servidor Node.js/WebSocket para multiplayer autoritativo.
qa/         Testes, planos de QA, fixtures e ferramentas de verificacao.
docs/       Roadmap, decisoes tecnicas e notas de arquitetura.
shared/     Tipos, constantes e regras compartilhadas entre cliente e servidor.
```

## Branches

```text
main      Base estavel e integracao.
frontend  Trabalho do cliente web e game feel local.
backend   Trabalho do servidor, salas e sincronizacao.
QA        Testes, validacao, automacao e planos de qualidade.
```

Regra pratica: cada mudanca deve nascer na branch que corresponde ao tipo de trabalho. Quando uma mudanca tocar mais de uma area, eu aviso antes e separo em passos menores sempre que fizer sentido.

