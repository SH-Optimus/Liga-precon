# 02 · Guia da organização

Painel: **`https://luiz-fernando.com/mtg/liga/admin.html`** (em outro servidor, `.../liga/admin.html`).

- [Entrar e cadastrar organizadores](#entrar-e-cadastrar-organizadores)
- [Roteiro de uma etapa](#roteiro-de-uma-etapa)
- [Criar e configurar um evento](#criar-e-configurar-um-evento)
- [Inscrições e participantes](#inscrições-e-participantes)
- [Rodadas e pareamento](#rodadas-e-pareamento)
- [Resultados](#resultados)
- [Corrigir erros nas rodadas](#corrigir-erros-nas-rodadas)
- [Mesa final](#mesa-final)
- [Fechar o evento](#fechar-o-evento)
- [Etapas com final pendente (importadas da planilha)](#etapas-com-final-pendente)
- [Modo TV para a loja](#modo-tv-para-a-loja)
- [Backup e exportação](#backup-e-exportação)
- [Outras ferramentas](#outras-ferramentas)

---

## Entrar e cadastrar organizadores

- **Entrar:** usuário e senha. O login vale até fechar o navegador; **Sair** no topo.
- **Primeiro login do sistema:** ver [01 · Instalação → Primeiro acesso](01-instalacao.md#primeiro-acesso).
- **Novos organizadores / trocar senha:** lista de eventos → **Organizadores** → usuário + senha (mín. 8) → **Salvar organizador**.
- Depois de 10 senhas erradas seguidas, o acesso daquele aparelho fica bloqueado por 15 minutos.

---

## Roteiro de uma etapa

| Quando | O que fazer | Onde |
|---|---|---|
| Dias antes | **+ Criar evento** com nome, etapa, data e hora. Divulgar `luiz-fernando.com/mtg/liga/` para os jogadores se inscreverem | Lista de eventos |
| Na chegada | Conferir pagamento (**Pago**), marcar **Presente** (ou **Marcar todos como presentes**), adicionar quem não se inscreveu | Participantes |
| Início | Abrir o **📺 Modo TV** na TV/notebook da loja. **Encerrar inscrições** se quiser travar novas inscrições pelo site | Topo do evento |
| Cada rodada | **Gerar rodada N** → acompanhar resultados (jogadores reportam pelo celular; a organização confirma ou lança) → **Fechar rodada** | Rodada atual |
| Fim do suíço | **Gerar mesa final** (top 4). Se a final for outro dia: **Publicar suíço (final pendente)** | Rodada atual |
| Fim da final | Lançar o vencedor da mesa final → **Fechar rodada** → **Fechar evento** → conferir a prévia → **Confirmar e fechar** | Rodada atual / topo |
| Depois | **💾 Banco completo** para guardar um backup | Lista de eventos → Backup e exportação |

Ao fechar o evento, a etapa entra no ranking anual, nos perfis, nas conquistas e na página do ranking **na hora**.

---

## Criar e configurar um evento

**+ Criar evento** (lista) ou **⚙ Configurações** (dentro do evento):

| Campo | Para que serve |
|---|---|
| Nome | Título que aparece em todo lugar (ex.: “Liga Precon BH 2026 - Etapa 10”) |
| **Etapa** | Número da etapa no ranking anual. **Obrigatório para fechar o evento** (exceto evento de teste) |
| Temporada | Ano do ranking (padrão: o ano atual) |
| Data / Hora | Mostradas na página e no modo TV |
| Rodadas suíças | Padrão 3 |
| Tempo por rodada | Padrão 90 minutos (cronômetro, faixa de “tempo esgotado” e aviso sonoro) |
| Descrição | Texto livre na página do evento |

Opções:

| Opção | Padrão | O que faz |
|---|---|---|
| Mesa final com o top 4 | ligada | Habilita a mesa final depois do suíço |
| Pré-inscrição | desligada | Inscrições pelo site ficam pendentes até a organização marcar **Aprov.** |
| Evento público | ligada | Aparece na lista pública. Desligado: só quem tem o link vê |
| **Evento de teste** | desligada | Para treinar. **Nunca entra no ranking**, mesmo fechado |
| Desabilitar bye | desligada | Em vez de deixar 1–3 jogadores de fora, completa com mesas de 3 (ex.: 17 = 2 mesas de 4 + 3 de 3) |
| Bye da 1ª rodada para os últimos do ranking | ligada | O bye da rodada 1 vai para quem está mais abaixo no ranking anual; estreantes jogam |
| Todos os byes pontuam | ligada | Desligado: só o 1º bye de cada jogador vale 3 pontos |
| Permitir ajuste de rodadas | ligada | Libera **Ajustar mesas** (trocar jogadores de lugar) numa rodada aberta |

**Cancelar evento** apaga o evento com inscrições e rodadas (pede confirmação; não existe para evento encerrado).

---

## Inscrições e participantes

Aba **Participantes**:

- **Inscrição pelo site:** os jogadores se inscrevem com nome, deck e PIN (ver [03 · Guia dos jogadores](03-guia-jogadores.md)). Decks banidos por performance são recusados.
- **Adicionar jogador** (balcão): nome (sugere quem já jogou), deck e “já presente”. Jogador adicionado pela organização não tem PIN até se inscrever pelo site uma vez; enquanto isso, a organização lança os resultados dele.
- **Encerrar inscrições / Reabrir inscrições** (topo): trava ou libera a inscrição pelo site. A organização continua podendo adicionar.

Colunas da tabela:

| Coluna | Uso |
|---|---|
| Deck | Editável. Avisa se o deck estiver banido |
| Aprov. | Só com pré-inscrição: aprova o inscrito |
| Pago | Controle de pagamento (não afeta o pareamento) |
| **Presente** | Só quem está **presente**, aprovado e sem drop entra no pareamento |
| Drop | Sai das próximas rodadas; os resultados até ali continuam valendo (inclusive para o desempate dos oponentes) |
| Ban | Desclassificado (lista modificada, conduta): sai do evento, não recebe pontos de liga e não vai à mesa final. Os jogos já feitos continuam valendo para os oponentes |
| ✕ | Exclui a inscrição (só antes de jogar alguma rodada; depois, use Drop) |

---

## Rodadas e pareamento

Aba **Rodada atual**:

- **Gerar rodada N**: monta as mesas.
  - Rodada 1: mesas sorteadas; o bye vai para os últimos do ranking anual (se a opção estiver ligada).
  - Rodadas seguintes: mesas por pontuação parecida, **evitando repetir oponentes**; o bye vai para quem ainda não teve, começando pelos últimos da classificação do dia.
  - A ordem dos assentos é sorteada (o 1º joga primeiro). Detalhes em [04 · Regras e cálculos](04-regras-e-calculos.md#pareamento).
- **Ajustar mesas** (embaixo das mesas): troca dois jogadores de lugar, só em mesas ainda sem resultado. Os relatos dos jogadores dessas mesas são apagados.
- **Desfazer rodada**: apaga a última rodada (mesas e resultados) para gerar de novo.

O cronômetro aparece no topo do evento, no celular dos jogadores e no modo TV. Ao zerar: faixa vermelha **“⏰ Tempo esgotado: último turno”** e aviso sonoro (uma vez por rodada; botão 🔔 liga/desliga). Pelo regulamento, cada jogador ainda joga um turno; **o sistema não lança empate sozinho**.

---

## Resultados

Cada mesa tem a caixa **Resultado**: *em andamento*, *Vitória de X* ou *Empate*.

- **Jogadores reportam pelo celular** com o PIN. Quando **dois jogadores da mesa reportam o mesmo resultado** (e ninguém reportou diferente), ele é confirmado sozinho.
- Os relatos aparecem embaixo de cada mesa (“Fulano reportou vitória de Ciclano”). Se houver **divergência**, a lista fica amarela: a organização decide escolhendo o resultado na caixa.
- **Fechar rodada** só libera quando todas as mesas têm resultado.

---

## Corrigir erros nas rodadas

Resultados de **rodada fechada não podem ser alterados**, porque já foram usados no pareamento seguinte (o sistema recusa, inclusive pela API).

- Erro na **última rodada** gerada, ainda sem a próxima: **Reabrir** → corrigir → **Fechar rodada**.
- Erro numa rodada que **já tem a seguinte**: **Desfazer rodada** na seguinte (apaga as mesas dela), **Reabrir** a anterior, corrigir, fechar e gerar de novo.
- Evento já **encerrado**: **Reabrir evento** (os pontos da etapa saem do ranking até fechar de novo).

A aba **Histórico** mostra todas as rodadas (fechadas aparecem só para consulta).

---

## Mesa final

Quando as rodadas suíças terminam, a aba Rodada atual mostra o quadro **Mesa final** com os finalistas: **os 4 primeiros do suíço** (sem drop e sem desclassificados).

- **Final no mesmo dia:** **Gerar mesa final** → jogar → escolher o vencedor (ou empate) → **Fechar rodada** → **Fechar evento**.
- **Final em outro dia:** **Publicar suíço (final pendente)**. A etapa aparece no ranking como “final pendente” (sem pontos de liga). No dia da final, volte ao evento: **Gerar mesa final** → vencedor → **Fechar rodada** → **Fechar evento**.
- **Vitória absoluta:** se um único jogador vencer as 3 rodadas sem bye (9 pontos), ele é campeão direto e o sistema não gera mesa final; feche o evento.
- **Empate na mesa final:** o campeão é o mais bem colocado no suíço (o regulamento não define; regra adotada pelo sistema).

---

## Fechar o evento

**Fechar evento** mostra uma prévia: colocação final, pontos do evento, V-E-D e **pontos de liga** de cada jogador (1º = 3, 2º ao 8º = 2, demais = 1). Confira e clique **Confirmar e fechar**.

- O campeão é o vencedor da mesa final; do 2º em diante vale a classificação suíça.
- Se a etapa já existia no histórico (por exemplo, importada da planilha ou publicada como final pendente), ela é substituída pelo resultado do sistema.
- **Evento de teste:** fecha sem mexer no ranking.

---

## Etapas com final pendente

Etapas que **não foram jogadas no sistema** (vieram da planilha/EMP) e ainda não têm a mesa final aparecem na lista de eventos, em **“Etapa NN · final pendente”**, com os finalistas (top 4 do suíço daquela etapa).

1. Escolha o **vencedor da final** (ou empate).
2. **Lançar final** → confirme.

O sistema calcula a colocação final, os pontos de liga e o V-E-D com o jogo da final, grava a mesa final no histórico e atualiza ranking, perfis e conquistas. Errou? **Lance de novo** com o vencedor certo (não duplica nada) ou use **Desfazer final** (a etapa volta exatamente ao estado da planilha).

---

## Modo TV para a loja

Botão **📺 Modo TV** no topo do evento (ou `.../liga/tv.html`, que abre sozinho o evento em andamento).

1. Abra na TV ou num notebook ligado à TV.
2. Clique **⛶ Tela cheia** e uma vez em **🔔 Som ligado** (o navegador só libera o som depois de um clique).
3. Não precisa mexer mais: atualiza a cada 10 segundos.

O que aparece: inscritos (antes de começar) → cronômetro gigante, mesas com assentos, decks e resultados, byes e classificação (durante a rodada) → “aguardando próxima rodada” → mesa final → campeão e classificação (evento encerrado). Se não couber tudo, alterna páginas a cada 12 segundos.

---

## Backup e exportação

Lista de eventos → **Backup e exportação**:

| Botão | Arquivo |
|---|---|
| 💾 Banco completo | Cópia de tudo (`.sqlite`) para guardar ou restaurar |
| Registro de jogos | CSV no formato da aba `tab_registrojogos` (uma linha por jogador por etapa, com Desempate TB e Pontuação Anual Final) |
| Mesas | CSV no formato da planilha “resultados liga precon” (uma linha por jogador por mesa) |
| Ranking anual / Ranking de decks / Matriz de confrontos | CSV nos formatos das abas da planilha da liga |

Dentro de cada evento: **⬇ Baixar resultado** (classificação e mesas do evento).

Os CSV usam `;` e vírgula decimal: abrem direto no Excel em português; no Google Planilhas use **Arquivo → Importar** (separador: ponto e vírgula).

---

## Outras ferramentas

- **Apagar PIN do jogador** (Organizadores): para quem esqueceu o PIN. Ele cria um novo na próxima inscrição pelo site.
- **Histórico da planilha → Recarregar**: só para quando um pacote novo trouxer correções da planilha nas etapas antigas. Substitui apenas etapas importadas da planilha; etapas do sistema e finais lançadas pelo painel não são tocadas.
- **Ver página pública ↗** (topo do evento): a mesma página que os jogadores veem.
