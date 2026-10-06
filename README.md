# Liga Precon BH — sistema de eventos e página do ranking

Sistema web da **Liga Precon BH** (Commander Precon, Vault of Cards, Belo Horizonte). Substitui o EMP Planar Forge e a atualização manual das planilhas:

- **Página do ranking** (`/mtg/`): ranking anual, corrida pelo título, etapas e campeões, decks, radar de banimento, comparativo 2025 × 2026 e calendário. Lê os dados do sistema e se atualiza sozinha.
- **Sistema de eventos** (`/mtg/liga/`): inscrição com PIN, pareamento suíço em mesas de 4 com os desempates do EMP, “minha mesa” no celular, reporte de resultados, mesa final, fechamento da etapa com pontos de liga, perfis de jogadores, páginas de decks com mapa de confrontos, 25 conquistas, modo TV para a loja, backup e exportação para planilhas.

## Documentação

| Guia | Para quem | Conteúdo |
|---|---|---|
| [01 · Instalação](docs/01-instalacao.md) | quem cuida do servidor | Requisitos, HostGator passo a passo, outros servidores (cPanel, Apache, Nginx, Docker), primeiro acesso, atualização |
| [02 · Guia da organização](docs/02-guia-organizacao.md) | organizadores | Criar evento, inscrições, check-in, rodadas, resultados, mesa final, fechar etapa, modo TV, backup |
| [03 · Guia dos jogadores](docs/03-guia-jogadores.md) | jogadores | Inscrição, PIN, minha mesa, reportar resultado, perfis, decks, conquistas |
| [04 · Regras e cálculos](docs/04-regras-e-calculos.md) | organização e curiosos | Pontuação, TB1/TB2/TB3 do EMP, pareamento, bye, ranking anual, banimento, confrontos, conquistas |
| [05 · Manutenção técnica](docs/05-manutencao-tecnica.md) | quem mexe no código | Arquitetura, banco de dados, API, página do ranking, pacote, testes, problemas comuns |
| [06 · Personalização](docs/06-personalizacao.md) | quem mantém o site | Menus, textos, cores, calendário, artes dos comandantes, regras, conquistas, nova temporada |

## Estrutura do projeto

```
liga-precon/
├── public/            → vira mtg/liga/ no servidor (sistema de eventos)
│   ├── index.html     página pública (eventos, jogadores, decks, conquistas)
│   ├── admin.html     painel da organização
│   ├── tv.html        modo TV para a loja
│   ├── api.php        API (todas as ações)
│   ├── assets/        CSS e JavaScript
│   └── lib/           PHP (regras, banco) + histórico importado (bloqueado para acesso externo)
├── ranking/           → vira a raiz de mtg/ no servidor (página do ranking)
│   ├── index.html
│   └── ranking/       ranking.css, ranking.js, dados-2025.json, cmd/ (artes dos comandantes)
├── tools/             scripts: gerar o histórico a partir da planilha, montar o pacote
├── tests/             testes automatizados e servidores de teste
└── dist/liga.zip      pacote pronto para subir (gerado por tools/package.py)
```

## Atualizar o site em 3 passos

1. Gere o pacote: `python3 tools/package.py` (cria `dist/liga.zip`).
2. No servidor, envie `liga.zip` para a pasta `mtg` e **extraia** (substitui os arquivos).
3. Recarregue o site. Os dados (eventos, histórico, jogadores) ficam fora da pasta pública e **não são afetados**.

Detalhes em [01 · Instalação](docs/01-instalacao.md#atualizar-o-sistema).
