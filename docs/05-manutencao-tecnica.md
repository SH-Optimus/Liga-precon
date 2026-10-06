# 05 · Manutenção técnica

Para quem vai mexer no código, gerar pacotes ou investigar problemas.

- [Visão geral](#visão-geral)
- [Arquivos](#arquivos)
- [Banco de dados](#banco-de-dados)
- [API](#api)
- [Página do ranking](#página-do-ranking)
- [Política de segurança (CSP) e regras do código](#política-de-segurança-csp-e-regras-do-código)
- [Ferramentas: histórico e pacote](#ferramentas-histórico-e-pacote)
- [Testes](#testes)
- [Solução de problemas](#solução-de-problemas)

---

## Visão geral

```
Navegador ──► mtg/index.html + ranking/ranking.js ──┐
              (página do ranking)                     │  fetch JSON
Navegador ──► mtg/liga/index.html, admin.html, tv.html│
              + assets/*.js                           ▼
                                        mtg/liga/api.php  ──►  lib/*.php  ──►  liga-data/liga.sqlite
```

- **Sem framework e sem dependências.** PHP puro + SQLite (PDO) no servidor; HTML, CSS e JavaScript puros no navegador.
- **Toda a interface é montada no navegador** a partir da API (JSON). Sem JavaScript, as páginas ficam vazias (por isso o painel lateral do app do Claude, que não roda JS, mostra só a moldura).
- **Fonte da verdade:** o banco SQLite. O histórico anterior ao sistema (Etapas 01–09 de 2026) veio das planilhas, importado na primeira execução.

---

## Arquivos

| Arquivo | Função |
|---|---|
| `public/api.php` | Ponto de entrada da API: sessão, autenticação, validação, roteamento das ações (`?a=...`), respostas JSON |
| `public/lib/config.php` | Constantes: pasta de dados, token de configuração, temporada, regras da liga |
| `public/lib/db.php` | Conexão SQLite, criação/migração das tabelas, importação do histórico (`seed.json`, `seed_games.json`), `reload_seed()` |
| `public/lib/tournament.php` | Classificação e desempates, pareamento, byes, mesa final, resultados, fechamento do evento |
| `public/lib/finals.php` | Final em outro dia: publicar suíço, final de etapas importadas, desfazer |
| `public/lib/season.php` | Ranking anual, decks, risco de banimento (formato usado pela página do ranking) |
| `public/lib/profile.php` | Perfis de jogadores e as 25 conquistas |
| `public/lib/decks.php` | Página de deck e matriz de confrontos |
| `public/lib/export.php` | CSVs no formato das planilhas e backup do banco |
| `public/lib/seed.json`, `seed_games.json` | Histórico importado das planilhas (gerado por `tools/build_seed.py`) |
| `public/assets/common.js` | Utilitários compartilhados: chamada da API, cronômetro, aviso sonoro e faixa de tempo esgotado, tabelas e cards de mesa |
| `public/assets/app.js` | Página pública: eventos, inscrição, minha mesa, reporte, drop |
| `public/assets/perfil.js` | Jogadores, perfil, conquistas |
| `public/assets/decks.js` | Lista de decks, mapa de confrontos, página de deck |
| `public/assets/admin.js` | Painel da organização |
| `public/assets/tv.js`, `tv.css` | Modo TV |
| `public/assets/app.css` | Estilos do sistema (claro/escuro) |
| `public/.htaccess`, `lib/.htaccess` | Bloqueiam listagem, `.sqlite/.json/.md/.py` e a pasta `lib` |
| `ranking/index.html` | Página do ranking (estrutura) |
| `ranking/ranking/ranking.js` | Monta a página do ranking a partir da API; calendário, artes, comparativo |
| `ranking/ranking/ranking.css` | Estilos da página do ranking |
| `ranking/ranking/dados-2025.json` | Dados fixos da temporada 2025 (comparativo) |
| `ranking/ranking/cmd/etN.jpg` | Arte do comandante campeão da etapa N |

---

## Banco de dados

Arquivo `liga-data/liga.sqlite` (modo WAL). Tabelas:

| Tabela | Conteúdo |
|---|---|
| `players` | Jogadores (nome único sem diferenciar maiúsculas, hash do PIN) |
| `admins` | Organizadores (hash da senha) |
| `events` | Eventos e suas opções (etapa, temporada, rodadas, tempo, pré-inscrição, teste, sem bye, bye pelo ranking, etc.) |
| `entries` | Inscrições: deck, aprovado, pago, presente, drop, desclassificado |
| `rounds` | Rodadas (`suico` ou `final`, `aberta`/`fechada`, horário de início) |
| `pods` | Mesas da rodada; `result` = `NULL` (jogando), `E` (empate), `V:<id da inscrição>` (vencedor) ou `B` (bye) |
| `seats` | Quem está em cada mesa e em qual assento |
| `reports` | Resultados reportados pelos jogadores |
| `history` | Uma linha por jogador por etapa (colocação, deck, pontos, TB1–3, V-E-D, pontos de liga). `source` = `planilha` ou `sistema` |
| `hist_games` | Uma linha por jogador por mesa (todas as etapas): base de perfis, confrontos e conquistas |
| `attempts` | Controle de tentativas de PIN e login (10 erros = 15 min de bloqueio) |

**Migrações:** `migrate()` em `db.php` cria o que faltar a cada conexão (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN` para colunas novas). Para adicionar uma coluna, inclua-a no `CREATE TABLE` **e** na lista `$add` de `migrate()`.

**Regra de ouro:** nunca apagar o banco do servidor. Atualizações de código não mexem nele; `reload_seed()` só toca linhas com `source = 'planilha'` de etapas que não pertencem ao sistema.

---

## API

`liga/api.php?a=<ação>`. Leituras por GET; escritas por **POST com JSON e o cabeçalho `X-Liga: 1`** (sem ele, recusa). Sessão de organizador por cookie (`HttpOnly`, `SameSite=Strict`, `Secure` em HTTPS).

**Públicas:** `events`, `event` (`id`), `season`, `player` (`name`), `decks_overview`, `deck` (`name`), `achievements`, `decks`, `players`, `register`, `report`, `drop`, `me`, `login`, `logout`, `setup`.

**Organização (login):** `admin_add`, `event_save`, `event_delete`, `entry_add`, `entry_update`, `entry_delete`, `reg_toggle`, `checkin_all`, `pin_reset`, `round_generate`, `final_generate`, `publish_swiss`, `swap`, `pod_result`, `round_close`, `round_reopen`, `round_delete`, `close_preview`, `event_close`, `event_reopen`, `imported_finals`, `imported_final`, `imported_final_undo`, `reload_seed`, `export` (`t` = `banco`, `registro`, `mesas`, `ranking`, `decks`, `confrontos`, `evento`).

Erros voltam como `{"error": "mensagem"}` com status HTTP 4xx/5xx. Erros internos são registrados no log do PHP com o prefixo `[liga]`.

---

## Página do ranking

`ranking/ranking/ranking.js`:

1. Ao carregar, busca `liga/api.php?a=season` (ranking, decks, registro das etapas) e `ranking/dados-2025.json`.
2. Chama `main(D, Y)`, que monta tudo: KPIs, corrida pelo título, tabela do ranking, etapas e cartas dos campeões, decks, radar de banimento, comparativo e calendário.
3. Etapas com pontos de liga ausentes (`ap = null`) aparecem como **final pendente**.
4. Nomes de jogadores e decks são links para `liga/#j/Nome` e `liga/#d/Deck`.

Como a página depende da API, ela precisa do sistema instalado em `mtg/liga/` (mesmo domínio).

---

## Política de segurança (CSP) e regras do código

O servidor usa uma política que permite **apenas scripts e estilos em arquivos próprios** (`script-src 'self'`, `style-src 'self' + Google Fonts`). Por isso:

- **Nada de `<script>` com código dentro do HTML**, nem `onclick="..."`. Todo JavaScript fica em arquivos `.js`.
- **Nada de `style="..."` no HTML** (nem gerado por JavaScript via `innerHTML`): o navegador ignora. Use classes do CSS.
  - No sistema (`public/`), use classes ou `elemento.style.prop = ...` em JavaScript (permitido).
  - Na página do ranking, os templates usam **`data-style="..."`**: um observador em `ranking.js` copia o conteúdo para `elemento.style.cssText` (permitido pela CSP).
- **Imagens:** só do próprio site ou `data:`. Imagens de outros sites (ex.: Scryfall) precisam ser baixadas e colocadas no servidor.
- **Conexões:** só para o próprio site (a API).

Para testar com a mesma política: `tests/router.php` (sistema) e `tests/router_mtg.php` (página + sistema) enviam o cabeçalho CSP do servidor.

---

## Ferramentas: histórico e pacote

**`tools/build_seed.py`** — gera `public/lib/seed.json` (resultados por etapa) e `seed_games.json` (mesas):

```bash
python3 tools/build_seed.py            # baixa a planilha LIGA PRECONBH 2026 (precisa estar compartilhada por link)
python3 tools/build_seed.py arquivo.xlsx
```

- Fonte dos resultados: aba `tab_registrojogos` da planilha da liga. A etapa é a ordem das datas (a coluna “Etapa Liga” guarda a data).
- Fonte das mesas: `tools/mesas-2026.xlsx` (planilha “resultados liga precon 2026”). Nomes são normalizados para o nome do ranking (sem diferenciar maiúsculas).
- Depois de gerar, monte o pacote, suba e use **Histórico da planilha → Recarregar** no painel.

**`tools/package.py`** — monta `dist/liga.zip`:

- copia `ranking/` (raiz do zip) e `public/` (pasta `liga/` do zip);
- gera um `SETUP_TOKEN` novo em `liga/lib/config.php`;
- acrescenta a versão (`?v=hash`) aos CSS/JS nas páginas, para os navegadores baixarem a versão nova.

```bash
python3 tools/package.py
```

---

## Testes

Rodam no Docker (não precisa de PHP instalado):

```bash
docker run --rm -v "$PWD":/app -w /app php:8.4-cli php tests/test_emp_evento09.php   # desempate idêntico ao EMP (Evento 09)
docker run --rm -v "$PWD":/app -w /app php:8.4-cli php tests/test_bye_ranking.php    # bye da rodada 1 pelo ranking
docker run --rm -v "$PWD":/app -w /app php:8.4-cli php tests/test_finals.php         # final em outro dia, etapas importadas
```

Simulação de um evento completo pela API (servidor de teste em `127.0.0.1:8770`):

```bash
docker run -d --name liga-dev -p 127.0.0.1:8770:8080 -e LIGA_DATA_DIR=/tmp/liga -e LIGA_SETUP_TOKEN=token-local-de-teste -v "$PWD":/app -w /app php:8.4-cli php -S 0.0.0.0:8080 tests/router.php
python3 tests/simulate.py
```

Outros: `tests/season_dump.php` (ranking em JSON), `tests/profile_dump.php` (conquistas e um perfil), `tests/decks_check.php` (matriz de confrontos).

---

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Página do ranking diz “Não foi possível carregar os dados” | API fora do ar ou pasta `liga/` ausente | Abra `mtg/liga/api.php?a=season`: deve mostrar JSON. Se der erro 500, veja a próxima linha |
| Erro 500 / “Não foi possível criar a pasta de dados” | Pasta de dados sem permissão ou caminho errado | Confira `DATA_DIR` em `config.php` e a permissão de escrita da pasta `liga-data` |
| Erro de sintaxe/página branca na API | PHP abaixo de 8.1 | Suba a versão do PHP no painel da hospedagem |
| Cores erradas, texto “colado”, layout sem estilo | Navegador usando CSS antigo | Ctrl+Shift+R. (O pacote versiona os arquivos; isso só acontece na página do ranking quando ela muda de formato) |
| Página sem nenhum estilo e sem dados | Política de segurança bloqueando código dentro do HTML | Não deve acontecer com o pacote atual. Verifique se algum arquivo foi editado com `style="..."` ou `<script>` interno |
| `liga/lib/config.php` abre no navegador | `.htaccess` ignorado (Nginx, `AllowOverride None`) | Ver [01 · Instalação](01-instalacao.md) (Apache/Nginx) |
| “Muitas tentativas. Espere 15 minutos.” | 10 erros de PIN ou senha na mesma rede | Esperar 15 minutos |
| Jogador sem PIN não consegue reportar | Foi adicionado pela organização | Ele se inscreve pelo site uma vez (cria o PIN) ou a organização lança o resultado |
| Cronômetro adiantado/atrasado | Relógio do aparelho errado | O sistema compensa usando a hora do servidor; recarregue a página |
| Ferramentas de linha de comando recebem erro 406 do site | Firewall da HostGator (mod_security) bloqueia clientes que não são navegadores | Não afeta usuários; use o navegador ou um backup |
| Painel lateral do app do Claude mostra a página vazia | O painel não executa JavaScript | Abra no navegador |
