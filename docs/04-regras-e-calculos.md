# 04 · Regras e cálculos

Como o sistema calcula cada número. Baseado no **Regulamento Liga Precon 2026** e no comportamento do **EMP Planar Forge**, conferido contra os resultados reais da temporada.

- [Pontuação das rodadas](#pontuação-das-rodadas)
- [Desempates (TB1, TB2, TB3)](#desempates-tb1-tb2-tb3)
- [Pareamento](#pareamento)
- [Bye](#bye)
- [Mesa final e colocação da etapa](#mesa-final-e-colocação-da-etapa)
- [Pontos de liga e ranking anual](#pontos-de-liga-e-ranking-anual)
- [Banimento por performance e risco](#banimento-por-performance-e-risco)
- [Estatísticas de decks e confrontos](#estatísticas-de-decks-e-confrontos)
- [Conquistas](#conquistas)

---

## Pontuação das rodadas

| Resultado | Pontos |
|---|---|
| Vitória | 3 |
| Empate (tempo esgotado sem vencedor, perda simultânea) | 1 |
| Derrota | 0 |
| Bye | 3 (não conta como vitória nem como partida) |

Mesas de 4 jogadores; um vencedor por mesa ou empate geral.

---

## Desempates (TB1, TB2, TB3)

A classificação de um evento ordena por **pontos → TB1 → TB2 → TB3**. Empate completo divide a posição (ex.: três jogadores em 15º, como no EMP).

**TB1 — sequência de rodadas sem derrota.** Cada rodada com vitória ou empate vale **2**, menos **1 para cada derrota seguida logo antes** (mínimo 0). O **bye conta como derrota** para esse desconto (não pontua no TB1 e reduz a rodada seguinte).

| Sequência | TB1 |
|---|---|
| V, E, V | 2 + 2 + 2 = **6** |
| E, D, E | 2 + 0 + 1 = **3** |
| D, D, E | 0 + 0 + 0 = **0** |
| Bye, E, D | 0 + 1 + 0 = **1** |

**TB2** = média dos **pontos** dos oponentes enfrentados (cada oponente conta **uma vez**, mesmo se enfrentado em duas rodadas).

**TB3** = média do **TB1** desses mesmos oponentes.

**Conferência com o EMP:** recalculando as 9 etapas de 2026 a partir das mesas, o TB1 bate em 155 de 156 casos, o TB3 em 150 e o TB2 em 140 (100% nas Etapas 01, 03, 04, 07 e 09). A Etapa 02 ficou fora da conferência: os números do EMP dela não batem com nenhuma regra (dados inconsistentes na origem). As diferenças restantes são pontuais (mesas corrigidas no EMP depois).

---

## Pareamento

- **Quem entra:** inscritos **presentes**, aprovados, sem drop e sem desclassificação.
- **Rodada 1:** ordem sorteada.
- **Rodadas seguintes:** jogadores ordenados pela classificação; as mesas são montadas em blocos de 4 e depois **otimizadas trocando jogadores entre mesas** para:
  1. **evitar reencontros** (repetir oponente custa muito mais que qualquer diferença de pontos);
  2. manter **pontuações parecidas** na mesma mesa.
- **Numeração:** Mesa 1 = mesa com a maior média de pontos.
- **Assentos:** ordem sorteada em cada mesa (o 1º joga primeiro).
- **Sem bye** (opção do evento): completa com mesas de 3 (ex.: 17 jogadores = 2 mesas de 4 + 3 de 3). Se não for possível (5 jogadores), usa bye.

Numa simulação com 18 jogadores e 3 rodadas, nenhum par de oponentes se repetiu.

---

## Bye

- Quantidade: o que sobrar da divisão por 4 (1 a 3 jogadores), salvo com a opção “Desabilitar bye”.
- **Rodada 1** (opção “Bye da 1ª rodada para os últimos do ranking”, ligada por padrão): vai para quem está mais abaixo no **ranking anual**, com desempate pela pontuação completa do ranking (vitórias, TB1, TB2, TB3). **Estreantes** (sem nenhuma etapa na temporada) jogam; só recebem bye se não houver mais ninguém.
- **Demais rodadas:** para quem ainda não teve bye, começando pelos últimos da classificação do dia.
- Vale 3 pontos; não entra em V-E-D, win rate do jogador nem do deck. Com “Todos os byes pontuam” desligado, só o 1º bye de cada jogador vale pontos.

---

## Mesa final e colocação da etapa

- **Finalistas:** os 4 primeiros da classificação suíça (sem drop/desclassificação).
- **Vitória absoluta:** único jogador com vitória nas 3 rodadas, sem bye (9 pontos) → campeão direto, sem mesa final.
- **Colocação final da etapa:**
  1. **Campeão** = vencedor da mesa final (em empate na final, o mais bem colocado no suíço — regra adotada pelo sistema);
  2. demais jogadores pela **classificação suíça**.
- O **V-E-D da etapa** inclui o jogo da mesa final (como na planilha da organização); os **pontos do evento** (“EMP Pontos”) são só do suíço.

---

## Pontos de liga e ranking anual

**Pontos de liga por etapa:**

| Colocação final | Pontos de liga |
|---|---|
| 1º | 3 |
| 2º ao 8º | 2 |
| 9º em diante | 1 |

(Regra observada em todas as etapas de 2026; constante `ANNUAL_TOP` em `config.php`.) Etapa com final pendente fica **sem pontos de liga** até a final ser lançada.

**Ranking anual:** ordenado pela **Pontuação Total Final**, um número com 11 casas decimais (regulamento, item 3):

```
pontos de liga , VV TTT DDD EEE
                 │  │   │   └ média do TB3 × 100 (3 dígitos)
                 │  │   └ média do TB2 × 100 (3 dígitos)
                 │  └ média do TB1 × 100 (3 dígitos)
                 └ vitórias no ano (2 dígitos, sem byes)
```

Exemplo: Morkan com 14 pontos, 5 vitórias, TB1 3,78, TB2 2,90, TB3 2,93 → **14,05378290293**. As médias de TB são a média das etapas jogadas. Bate com a planilha da organização para os 59 jogadores.

**Exportação “Registro de jogos”:** a coluna **Desempate TB** usa `vitórias/10 + TB1/100 + TB2/1.000 + TB3/1.000.000` e a **Pontuação Anual Final** = pontos de liga + Desempate TB (igual à aba `tab_registrojogos`).

---

## Banimento por performance e risco

**Banido** (regulamento): **mais de 33,33%** de vitórias **e** pelo menos **24 partidas**, somando todos os pilotos. Byes não contam; a mesa final conta. Decks banidos são recusados na inscrição.

> A planilha antiga usava “33,33% ou mais”. O sistema segue o regulamento (“superior a”). Para mudar, ajuste `BAN_WINRATE` (ver [06 · Personalização](06-personalizacao.md#regras-da-liga)).

**Risco** (radar da página do ranking e páginas de deck):

| Risco | Critério |
|---|---|
| Banido | já cumpre o critério |
| **Alto** | pode ser banido **na próxima etapa** (com até 4 partidas a mais — 3 rodadas + final — vencendo todas) |
| Médio | 15+ partidas, ou win rate acima de 33,33% com 9+ partidas |
| Baixo | o resto |

---

## Estatísticas de decks e confrontos

- **Win rate do deck** = vitórias ÷ partidas (inclui mesa final, sem byes), somando todos os pilotos.
- **Matriz de confrontos (deck × deck):** em cada mesa com vencedor, o deck vencedor soma **+1 contra cada deck derrotado** e cada derrotado soma −1 contra o vencedor. Regras:
  - **inclui a mesa final**;
  - **dois pilotos do mesmo deck na mesma mesa contam como um** (ex.: Reap the Tides vencendo dois Quandrix Unlimited = +1);
  - espelhos (deck contra ele mesmo) não contam; empates não mexem no saldo.
- Conferida contra a planilha “confrontos decks 2026”: idêntica em todas as células, exceto o deck do Fabio C na Etapa 09 (Squirreled Away na matriz, Blame Game nas outras planilhas; o sistema usa Blame Game).

---

## Conquistas

Calculadas em ordem cronológica (etapa a etapa) a partir das mesas, para saber **em qual etapa** cada uma foi desbloqueada. Valem desde a Etapa 01.

| Grupo | Conquista | Critério |
|---|---|---|
| Vitórias | 🩸 Primeiro Sangue | 1ª vitória numa mesa |
| | 🏆 Campeão da Etapa | venceu uma etapa (repetível ×2, ×3…) |
| | 👑 Coroa Tripla | venceu as 3 rodadas suíças de uma etapa |
| | ⚡ Vitória Absoluta | campeão sem mesa final |
| | 🎖️ Rei da Mesa Final | chegou a 3 mesas finais |
| | 🔥 Sequência Mortal | 3 vitórias seguidas (mesmo entre etapas; byes não interrompem) |
| | ↩️ Virada | perdeu a rodada 1 e chegou à mesa final na mesma etapa |
| Decks | 🗃️ Colecionador | jogou com 5 decks diferentes |
| | 🎭 Mestre de Muitos | venceu com 3 decks diferentes |
| | 🛡️ Fiel ao Comandante | mesmo deck em 4 etapas |
| | 🐴 Azarão | venceu com um deck de win rate abaixo de 15% na liga (deck com 6+ partidas) |
| | 🧭 Pioneiro | primeiro a levar um deck novo para a liga (não vale na 1ª etapa da temporada) |
| | 🗡️ Caçador de Gigantes | venceu uma mesa contra um deck em risco alto ou banido |
| Presença | 🎟️ Estreia | jogou a primeira etapa |
| | 🎒 Veterano | 5 etapas na temporada |
| | ⛓️ Presença de Ferro | jogou **todas** as etapas da temporada até agora (perde se faltar a uma) |
| | 🤝 Social | enfrentou 30 jogadores diferentes |
| | 🕊️ Pacificador | 10 empates |
| | 🍀 Sorte do Bye | 3 byes |
| Rivalidades | 😈 Nêmesis | venceu o mesmo jogador 3 vezes |
| | ⚔️ Vingança | venceu alguém que já tinha te vencido |
| | 🎯 Matador de Líder | venceu uma mesa com o 1º do ranking anual (posição antes da etapa) |
| Ranking | 🔟 Top 10 | ficou no top 10 depois de uma etapa |
| | 🥇 Líder | foi o 1º depois de uma etapa |
| | 📈 Escalada | subiu 10 posições de uma etapa para a outra |

**Raridade:** pela porcentagem de jogadores da temporada que têm a conquista — **Mítica** (< 5%), **Rara** (< 20%), **Incomum** (< 50%), **Comum** (≥ 50%).
