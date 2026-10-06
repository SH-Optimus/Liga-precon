# 06 · Personalização e manutenção do conteúdo

Onde mudar menus, textos, cores, calendário, artes, regras e conquistas. Todos os caminhos são relativos à pasta do projeto `liga-precon/`.

> **Depois de qualquer mudança:** gere o pacote (`python3 tools/package.py`), envie `dist/liga.zip` para `public_html/mtg` e extraia. Os dados do banco não são afetados. Para testar antes no próprio computador, ver [01 · Instalação → Testar no próprio computador](01-instalacao.md#testar-no-próprio-computador).
>
> **Não edite direto no servidor** (pelo “Editar” do cPanel): a próxima atualização sobrescreve. Edite no projeto e gere o pacote.

- [Menus](#menus)
- [Textos e títulos](#textos-e-títulos)
- [Cores e visual](#cores-e-visual)
- [Calendário e próxima etapa](#calendário-e-próxima-etapa)
- [Artes dos comandantes campeões](#artes-dos-comandantes-campeões)
- [Inscrição, pote e premiação](#inscrição-pote-e-premiação)
- [Regras da liga](#regras-da-liga)
- [Conquistas](#conquistas)
- [Nova temporada](#nova-temporada)
- [Regras ao editar o código](#regras-ao-editar-o-código)

---

## Menus

### Página do ranking (`mtg/`)
Arquivo **`ranking/index.html`**, bloco `<nav class="tabs">`:

```html
<nav class="tabs" aria-label="Seções">
  <div class="in">
    <a href="#ranking">Ranking</a>
    <a href="#etapas">Etapas</a>
    ...
    <a href="liga/#jogadores">Jogadores ↗</a>
    <a href="liga/#conquistas">Conquistas ↗</a>
  </div>
</nav>
```

- **Renomear:** troque o texto entre `<a ...>` e `</a>`.
- **Remover:** apague a linha `<a ...>`.
- **Reordenar:** mude a ordem das linhas.
- **Link para uma seção da página:** `href="#id-da-secao"` (precisa existir um `<section ... id="id-da-secao">` na página). Esses links rolam a página e ficam destacados conforme a rolagem.
- **Link para outra página:** qualquer endereço que não comece com `#` (ex.: `liga/#decks`, `https://...`). Esses não interferem na rolagem.

As seções existentes: `ranking`, `etapas`, `decks`, `banimento`, `comparativo`, `calendario`.

### Sistema de eventos (`mtg/liga/`)
- **Página pública:** `public/index.html`, linha `<nav>…</nav>` (Eventos, Jogadores, Decks, Conquistas, Ranking, Organização).
- **Painel da organização:** `public/admin.html`, linha `<nav>…</nav>` (Página pública, Ranking, Sair).
- **Modo TV:** `public/tv.html` (barra do topo).

Endereços internos disponíveis na página pública: `./` (eventos), `./#jogadores`, `./#decks`, `./#decks/mapa`, `./#conquistas`, `./#e/<id do evento>`, `./#j/<nome do jogador>`, `./#d/<nome do deck>`, `../` (página do ranking).

---

## Textos e títulos

| O quê | Onde |
|---|---|
| Título da página do ranking (aba do navegador e título grande) | `ranking/index.html`: `<title>` e `<h1>` (“Liga Precon BH 2026”) |
| Linha acima do título (“Commander Precon · Vault of Cards · Belo Horizonte”) | `ranking/index.html`, `<span class="eyebrow">` no topo |
| Subtítulo (“Temporada até a Etapa 09…”) | Gerado automaticamente em `ranking/ranking/ranking.js` (busque `heroSub`) |
| Títulos e textos das seções (Ranking anual, Etapas, Decks…) | `ranking/index.html`, dentro de cada `<section>` |
| Rodapé “Fontes: …” | `ranking/index.html`, `<footer class="src">` |
| Nome “Liga Precon BH” no sistema | `public/index.html`, `admin.html` e `tv.html` (`<b>Liga Precon BH</b>` e `<title>`) |
| Textos das telas do sistema | Nos arquivos `public/assets/*.js` (busque a frase exata) |
| Mensagens de erro e confirmação da API | `public/api.php` e `public/lib/*.php` (busque a frase) |

---

## Cores e visual

As cores são **variáveis CSS** (tokens) no início de cada arquivo de estilo:

| Arquivo | Vale para |
|---|---|
| `ranking/ranking/ranking.css` | Página do ranking (tem 3 blocos: claro, escuro automático e escuro forçado — mude nos três) |
| `public/assets/app.css` | Sistema de eventos (bloco claro `:root{...}` e bloco escuro dentro de `@media (prefers-color-scheme:dark)`) |
| `public/assets/tv.css` | Modo TV (sempre escuro; tokens em `body.tv{...}`) |

Principais tokens:

| Token | Uso |
|---|---|
| `--accent` | Vermelho da marca: botões principais, links, faixa do topo |
| `--gold` | Dourado: destaques, top 10, medalhas |
| `--bg`, `--surface`, `--surface-2` | Fundo da página e dos cartões |
| `--ink`, `--ink-2`, `--ink-3` | Texto principal, secundário e apagado |
| `--good`, `--warn`, `--crit` | Verde (vitória), amarelo (empate/aviso), vermelho (derrota/risco) |

Fontes: Archivo (títulos), IBM Plex Sans (texto) e IBM Plex Mono (números), carregadas do Google Fonts no `<head>` de cada página.

Cores de fundo das cartas de campeão sem arte: lista `MANA` em `ranking/ranking/ranking.js` (alterna as 5 cores de mana).

---

## Calendário e próxima etapa

Arquivo **`ranking/ranking/ranking.js`**, lista `CAL`:

```js
const CAL=[
 {n:'Etapa 01',d:'2026-01-31',et:1},
 ...
 {n:'Etapa 09',d:'2026-10-03',et:9,form:'https://forms.gle/...',emp:'https://www.planarforge.com/...'},
 {n:'Etapa 10',d:'2026-10-31',et:10,obs:'última etapa prevista'},
 {n:'Data reservada',d:'2026-11-07'},
];
```

| Campo | Significado |
|---|---|
| `n` | Nome mostrado |
| `d` | Data no formato `AAAA-MM-DD` (o horário 10:00 é fixo) |
| `et` | Número da etapa (deixe de fora para datas reservadas) |
| `form` | (opcional) link de inscrição — vira o botão “Inscrever-se” no topo e no calendário |
| `emp` | (opcional) link do evento no EMP |
| `obs` | (opcional) observação no calendário |

O cartão “Próxima etapa” do topo e a contagem de dias são calculados sozinhos: é a primeira etapa da lista com data no futuro. Com o sistema de inscrições, o `form` pode apontar para a página do evento: `form:'liga/#e/12'`.

---

## Artes dos comandantes campeões

1. Recorte **só a ilustração** da carta do comandante (sem moldura e sem o nome), em JPG, de preferência **400×292 px** (proporção ~1,37).
2. Salve como `ranking/ranking/cmd/et10.jpg` (troque 10 pelo número da etapa).
3. Em `ranking/ranking/ranking.js`, na linha `const CMD = {...}`, acrescente a etapa:
   ```js
   "10": {"n": "Nome do Comandante", "img": "ranking/cmd/et10.jpg"}
   ```
4. Gere o pacote e suba.

Etapa sem arte cadastrada aparece com o fundo colorido e o nome do mês. Imagens de outros sites (Scryfall etc.) **não carregam** por causa da política de segurança: a imagem precisa estar no servidor.

---

## Inscrição, pote e premiação

Em `ranking/ranking/ranking.js`:

- `fee=30` — valor da inscrição (R$).
- `potAnual=insc*fee*.7*.25` — pote anual = inscrições × valor × 70% (premiação) × 25% (parte anual).
- Pote mensal de cada etapa (dica do gráfico de participação e tabela da etapa): `n*fee*.7*.75`.
- Faixas de premiação mensal (até 16 = top 4, 17–24 = top 8, 25+ = top 12): busque `cut=n<=16?4:n<=24?8:12`.

---

## Regras da liga

Arquivo **`public/lib/config.php`** (vale para todo o sistema):

| Constante | Padrão | Efeito |
|---|---|---|
| `SEASON` | 2026 | Temporada padrão de novos eventos, do ranking e da página do ranking |
| `ROUND_MINUTES` | 90 | Tempo padrão da rodada ao criar evento |
| `SWISS_ROUNDS` | 3 | Rodadas suíças padrão ao criar evento (também usado no cálculo de risco) |
| `POD_SIZE` | 4 | Jogadores por mesa |
| `BAN_MIN_GAMES` | 24 | Banimento: mínimo de partidas |
| `BAN_WINRATE` | 1/3 | Banimento: win rate **acima** disso |
| `ANNUAL_TOP` | 8 | 1º = 3 pontos de liga; 2º até este número = 2; demais = 1 |
| `DATA_DIR` | `../../../../liga-data` | Pasta do banco (ver [01 · Instalação](01-instalacao.md#como-os-arquivos-ficam-no-servidor)) |
| `SETUP_TOKEN` | gerado pelo pacote | Só para o primeiro login |

Tempo de rodada, número de rodadas, mesa final, bye e as outras opções também podem ser ajustados **por evento** no painel (⚙ Configurações), sem mexer no código.

O critério de **risco** de banimento (Alto/Médio/Baixo) fica em `public/lib/season.php`, função `deck_risk`.

---

## Conquistas

Arquivo **`public/lib/profile.php`**.

**Renomear, mudar descrição, ícone ou grupo:** edite a lista `ACHIEVEMENTS` no topo:

```php
'social' => ['Social', 'Enfrentou 30 jogadores diferentes', 'Presença', '🤝', false],
//  id       nome      descrição                            grupo       ícone  repetível
```

**Mudar o critério** (ex.: Social com 25 oponentes): busque o `id` no arquivo (`'social'`) e ajuste o número na linha correspondente (`count($p['opps']) >= 30`). Atualize a descrição junto.

**Criar uma conquista nova:**
1. Acrescente uma linha em `ACHIEVEMENTS` com um `id` novo.
2. Na função `season_profiles`, chame `$unlock($p, 'id_novo', $e);` no ponto certo: dentro do laço das mesas (para eventos de jogo, como vitórias) ou no bloco “Verificações ao fim da etapa” (para contagens acumuladas).
3. Rode `php tests/profile_dump.php` (via Docker) para ver quem ganhou.

As conquistas são recalculadas a cada visita a partir do histórico: mudar um critério vale retroativamente para toda a temporada.

---

## Nova temporada

Ao começar 2027:

1. `public/lib/config.php`: `SEASON = 2027`.
2. `ranking/index.html`: título e `<h1>` para 2027; rodapé “Fontes”.
3. `ranking/ranking/ranking.js`: novo `CAL` (datas de 2027) e `CMD` vazio (`const CMD = {};`), removendo as imagens antigas de `ranking/ranking/cmd/` se quiser.
4. **Comparativo com o ano anterior:** a seção “2025 × 2026” usa `ranking/ranking/dados-2025.json`. Para comparar 2026 × 2027 é preciso gerar o arquivo da temporada anterior a partir do sistema e ajustar os textos da seção — peça para quem faz a manutenção.
5. Gere o pacote e suba. Os eventos de 2027 são criados com **Temporada 2027** no painel; o histórico de 2026 continua no banco (perfis, conquistas e exportações aceitam a temporada como parâmetro).

---

## Regras ao editar o código

- **Sem `style="..."` e sem `<script>` com código dentro do HTML** — a política de segurança do servidor bloqueia. Use classes CSS e arquivos `.js` (detalhes em [05 · Manutenção técnica](05-manutencao-tecnica.md#política-de-segurança-csp-e-regras-do-código)).
- Escape textos vindos de usuários com `esc(...)` antes de colocar no HTML.
- Depois de editar, teste localmente e rode os testes de [05 · Manutenção técnica](05-manutencao-tecnica.md#testes).
- Sempre gere o pacote com `tools/package.py` (ele versiona os arquivos e gera o token).
