<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/season.php';

/* ============================================================
   Leitura do evento
   ============================================================ */

function event_rounds(int $eventId): array {
    $rounds = all('SELECT * FROM rounds WHERE event_id = ? ORDER BY number', [$eventId]);
    foreach ($rounds as &$r) {
        $pods = all('SELECT * FROM pods WHERE round_id = ? ORDER BY bye, table_no', [$r['id']]);
        foreach ($pods as &$p) {
            $p['seats'] = all('SELECT s.seat, s.entry_id, pl.name, en.deck
                               FROM seats s JOIN entries en ON en.id = s.entry_id JOIN players pl ON pl.id = en.player_id
                               WHERE s.pod_id = ? ORDER BY s.seat', [$p['id']]);
        }
        $r['pods'] = $pods;
    }
    return $rounds;
}

// Resultado de um jogador numa mesa: 'V', 'E', 'D', 'B' (bye) ou null (em andamento)
function seat_result(array $pod, int $entryId): ?string {
    if ($pod['bye']) return 'B';
    $res = $pod['result'];
    if ($res === null) return null;
    if ($res === 'E') return 'E';
    return ((int)substr($res, 2) === $entryId) ? 'V' : 'D';
}

/* ============================================================
   Classificação suíça com os desempates do EMP
   - Pontos: vitória 3, empate 1, derrota 0, bye 3
   - TB1: cada rodada sem derrota vale 2, menos 1 por derrota (ou bye) seguida logo antes (mínimo 0).
   - TB2: média dos pontos dos oponentes enfrentados (cada oponente conta uma vez)
   - TB3: média do TB1 desses oponentes
   Conferido contra o EMP no Evento 09 (03/10/2026): os 17 jogadores batem.
   ============================================================ */

function standings(int $eventId, ?array $rounds = null): array {
    $rounds = $rounds ?? event_rounds($eventId);
    $ev = one('SELECT all_byes_score FROM events WHERE id = ?', [$eventId]);
    $allByes = !$ev || (int)$ev['all_byes_score'] === 1;
    $entries = all('SELECT en.id, en.deck, en.dropped, en.dq, en.checked_in, en.paid, en.approved, pl.name, pl.id AS player_id
                    FROM entries en JOIN players pl ON pl.id = en.player_id WHERE en.event_id = ?', [$eventId]);
    $S = [];
    foreach ($entries as $e) {
        $S[$e['id']] = $e + ['pts' => 0, 'v' => 0, 'e' => 0, 'd' => 0, 'byes' => 0, 'seq' => [], 'opp' => [],
                             'tb1' => 0.0, 'tb2' => 0.0, 'tb3' => 0.0, 'final' => null];
    }
    foreach ($rounds as $r) {
        foreach ($r['pods'] as $p) {
            $ids = array_map(fn($s) => (int)$s['entry_id'], $p['seats']);
            foreach ($ids as $id) {
                if (!isset($S[$id])) continue;
                $res = seat_result($p, $id);
                if ($r['kind'] === 'final') { $S[$id]['final'] = $res; continue; }
                if ($res === null) continue;
                $S[$id]['seq'][] = $res;
                if ($res === 'B') { $S[$id]['pts'] += ($allByes || $S[$id]['byes'] === 0) ? 3 : 0; $S[$id]['byes']++; continue; }
                $S[$id]['pts'] += ['V' => 3, 'E' => 1, 'D' => 0][$res];
                $S[$id][strtolower($res)]++;
                foreach ($ids as $o) if ($o !== $id) $S[$id]['opp'][$o] = true;
            }
        }
    }
    foreach ($S as &$s) $s['tb1'] = tb1($s['seq']);
    unset($s);
    foreach ($S as &$s) {
        $opp = array_keys($s['opp']);
        $n = count($opp);
        $s['tb2'] = $n ? array_sum(array_map(fn($o) => $S[$o]['pts'], $opp)) / $n : 0.0;
        $s['tb3'] = $n ? array_sum(array_map(fn($o) => $S[$o]['tb1'], $opp)) / $n : 0.0;
        $s['opp'] = $opp;
    }
    unset($s);
    $list = array_values($S);
    usort($list, fn($a, $b) => [$b['pts'], $b['tb1'], round($b['tb2'], 2), round($b['tb3'], 2), $a['name']]
                             <=> [$a['pts'], $a['tb1'], round($a['tb2'], 2), round($a['tb3'], 2), $b['name']]);
    // Empate completo divide a posição (como no EMP: 15º, 15º, 15º)
    $prev = null;
    foreach ($list as $i => &$s) {
        $key = [$s['pts'], $s['tb1'], round($s['tb2'], 2), round($s['tb3'], 2)];
        $s['rank'] = ($prev && $prev[0] === $key) ? $prev[1] : $i + 1;
        $prev = [$key, $s['rank']];
    }
    return $list;
}

// O bye conta como derrota para o desconto (não pontua no TB1 e reduz a rodada seguinte).
// Calibrado com as 9 etapas de 2026: bate com o EMP em 155 de 156 casos (Etapa 02 fora: dados inconsistentes).
function tb1(array $seq): float {
    $t = 0; $losses = 0;
    foreach ($seq as $r) {
        if ($r === 'V' || $r === 'E') { $t += max(0, 2 - $losses); $losses = 0; }
        else $losses++;   // 'D' ou 'B'
    }
    return (float)$t;
}

/* ============================================================
   Pareamento
   ============================================================ */

// Gera a próxima rodada suíça. Retorna o id da rodada.
function generate_swiss_round(int $eventId, ?int $seed = null): int {
    $ev = one('SELECT * FROM events WHERE id = ?', [$eventId]);
    if (!$ev || $ev['status'] === 'encerrado') throw new UserError('Evento encerrado ou inexistente.');
    $rounds = event_rounds($eventId);
    $swiss = array_values(array_filter($rounds, fn($r) => $r['kind'] === 'suico'));
    if (array_filter($rounds, fn($r) => $r['kind'] === 'final')) throw new UserError('A mesa final já foi gerada.');
    $nRounds = (int)$ev['rounds'];
    if (count($swiss) >= $nRounds) throw new UserError('As ' . $nRounds . ' rodadas suíças já foram geradas.');
    foreach ($rounds as $r) if ($r['status'] !== 'fechada') throw new UserError('Feche a rodada ' . $r['number'] . ' antes de gerar a próxima.');

    $st = standings($eventId, $rounds);
    $active = array_values(array_filter($st, fn($s) => !$s['dropped'] && !$s['dq'] && $s['checked_in'] && $s['approved']));
    if (count($active) < 3) throw new UserError('São necessários pelo menos 3 jogadores presentes (check-in), aprovados e não dropados.');
    if ($seed !== null) mt_srand($seed);

    $roundNo = count($swiss) + 1;
    $prevByes = []; $met = [];
    foreach ($rounds as $r) foreach ($r['pods'] as $p) {
        $ids = array_map(fn($s) => (int)$s['entry_id'], $p['seats']);
        if ($p['bye']) { foreach ($ids as $id) $prevByes[$id] = true; continue; }
        foreach ($ids as $a) foreach ($ids as $b) if ($a !== $b) $met[$a][$b] = ($met[$a][$b] ?? 0) + 1;
    }

    // Ordem: rodada 1 sorteada; depois pela classificação, com sorteio entre empatados
    $order = $active;
    foreach ($order as &$o) $o['_rnd'] = mt_rand();
    unset($o);
    if ($roundNo === 1) usort($order, fn($a, $b) => $a['_rnd'] <=> $b['_rnd']);
    else usort($order, fn($a, $b) => [$a['rank'], $a['_rnd']] <=> [$b['rank'], $b['_rnd']]);

    $n = count($order);
    $sizes = pod_sizes($n, (bool)$ev['no_bye']);
    $nByes = $n - array_sum($sizes);
    $byes = [];
    if ($nByes) {
        if ($roundNo === 1 && $ev['bye_by_ranking']) {
            $cands = round1_bye_order($order, (int)$ev['season']);
        } else {
            // Bye para quem ainda não teve, começando pelos últimos da classificação
            $cands = array_reverse($order);
            usort($cands, fn($a, $b) => [isset($prevByes[$a['id']]) ? 1 : 0] <=> [isset($prevByes[$b['id']]) ? 1 : 0]);
        }
        $byes = array_slice($cands, 0, $nByes);
        $byeIds = array_column($byes, 'id');
        $order = array_values(array_filter($order, fn($o) => !in_array($o['id'], $byeIds, true)));
    }

    $pts = array_column($order, 'pts', 'id');
    $ids = array_column($order, 'id'); $pods = [];
    foreach ($sizes as $sz) $pods[] = array_splice($ids, 0, $sz);
    if ($roundNo > 1) $pods = optimize_pods($pods, $pts, $met);

    // Mesa 1 = mesa com a maior média de pontos
    $avg = fn($p) => array_sum(array_map(fn($i) => $pts[$i], $p)) / count($p);
    usort($pods, fn($a, $b) => $avg($b) <=> $avg($a));

    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('INSERT INTO rounds (event_id, number, kind) VALUES (?, ?, \'suico\')', [$eventId, $roundNo]);
        $rid = (int)$pdo->lastInsertId();
        foreach ($pods as $i => $pod) insert_pod($rid, $i + 1, $pod, false);
        if ($byes) insert_pod($rid, 0, array_column($byes, 'id'), true);
        q('UPDATE events SET status = \'andamento\' WHERE id = ?', [$eventId]);
        $pdo->commit();
    } catch (Throwable $t) { $pdo->rollBack(); throw $t; }
    return $rid;
}

// Ordem de prioridade do bye na rodada 1: do último para o primeiro do ranking anual
// (desempate pela pontuação completa do ranking). Estreantes da temporada vão para o fim da fila, sorteados.
function round1_bye_order(array $players, int $season): array {
    $rk = [];
    foreach (season_data($season)['pl'] as $p) $rk[mb_strtolower($p['n'])] = $p['rk'];
    $ranked = array_values(array_filter($players, fn($p) => isset($rk[mb_strtolower($p['name'])])));
    $new = array_values(array_filter($players, fn($p) => !isset($rk[mb_strtolower($p['name'])])));
    usort($ranked, fn($a, $b) => $rk[mb_strtolower($b['name'])] <=> $rk[mb_strtolower($a['name'])]);
    shuffle_mt($new);
    return array_merge($ranked, $new);
}

function insert_pod(int $roundId, int $tableNo, array $entryIds, bool $bye): void {
    q('INSERT INTO pods (round_id, table_no, bye, result) VALUES (?, ?, ?, ?)', [$roundId, $tableNo, $bye ? 1 : 0, $bye ? 'B' : null]);
    $pid = (int)db()->lastInsertId();
    if (!$bye) shuffle_mt($entryIds);   // ordem dos assentos sorteada
    foreach (array_values($entryIds) as $i => $id) q('INSERT INTO seats (pod_id, entry_id, seat) VALUES (?, ?, ?)', [$pid, $id, $i + 1]);
}

function shuffle_mt(array &$a): void {
    for ($i = count($a) - 1; $i > 0; $i--) { $j = mt_rand(0, $i); [$a[$i], $a[$j]] = [$a[$j], $a[$i]]; }
}

// Troca jogadores entre mesas para evitar reencontros e manter pontuações parecidas na mesma mesa
function pod_cost(array $pod, array $pts, array $met): float {
    $c = 0.0;
    foreach ($pod as $i => $a) foreach ($pod as $j => $b) if ($i < $j) $c += 100 * ($met[$a][$b] ?? 0);
    $p = array_map(fn($x) => $pts[$x], $pod);
    return $c + (max($p) - min($p)) ** 2;
}

function optimize_pods(array $pods, array $pts, array $met): array {
    $k = count($pods);
    if ($k < 2) return $pods;
    $cost = array_map(fn($p) => pod_cost($p, $pts, $met), $pods);
    for ($iter = 0, $stale = 0; $iter < 5000 && $stale < 600; $iter++) {
        $x = mt_rand(0, $k - 1); $y = mt_rand(0, $k - 2); if ($y >= $x) $y++;
        $i = mt_rand(0, count($pods[$x]) - 1); $j = mt_rand(0, count($pods[$y]) - 1);
        $A = $pods[$x]; $B = $pods[$y];
        [$A[$i], $B[$j]] = [$B[$j], $A[$i]];
        $ca = pod_cost($A, $pts, $met); $cb = pod_cost($B, $pts, $met);
        if ($ca + $cb < $cost[$x] + $cost[$y]) {
            $pods[$x] = $A; $pods[$y] = $B; $cost[$x] = $ca; $cost[$y] = $cb; $stale = 0;
        } else $stale++;
    }
    return $pods;
}

// Vitória absoluta: único jogador com 9 pontos vencendo as 3 rodadas, sem bye
function absolute_winner(array $st, int $rounds): ?array {
    $top = array_values(array_filter($st, fn($s) => $s['pts'] >= $rounds * 3));
    if (count($top) === 1 && $top[0]['v'] === $rounds && $top[0]['byes'] === 0) return $top[0];
    return null;
}

// Tamanhos das mesas. Com bye: mesas de 4 e o resto fica de bye. Sem bye: completa com mesas de 3
// (17 jogadores = 2 mesas de 4 + 3 de 3); se não der (5 jogadores), volta a usar bye.
function pod_sizes(int $n, bool $noBye): array {
    if ($n < POD_SIZE) return [$n];
    if ($noBye) {
        $k = (int)ceil($n / POD_SIZE); $three = $k * POD_SIZE - $n;
        if ($three <= $k) return array_merge(array_fill(0, $k - $three, POD_SIZE), array_fill(0, $three, POD_SIZE - 1));
    }
    return array_fill(0, intdiv($n, POD_SIZE), POD_SIZE);
}

// $entryIds: finalistas escolhidos pela organização (ex.: um classificado não pôde ficar e o próximo foi chamado).
// Sem escolha, usa o top 4 da classificação suíça (sem drop e sem desclassificados).
function generate_final(int $eventId, ?array $entryIds = null): int {
    $ev = one('SELECT * FROM events WHERE id = ?', [$eventId]);
    if (!$ev['final_table']) throw new UserError('Este evento foi criado sem mesa final.');
    $rounds = event_rounds($eventId);
    $swiss = array_filter($rounds, fn($r) => $r['kind'] === 'suico');
    if (count($swiss) < (int)$ev['rounds']) throw new UserError('A mesa final só pode ser gerada depois das ' . $ev['rounds'] . ' rodadas.');
    foreach ($rounds as $r) {
        if ($r['kind'] === 'final') throw new UserError('A mesa final já existe.');
        if ($r['status'] !== 'fechada') throw new UserError('Feche a rodada ' . $r['number'] . ' antes.');
    }
    $st = standings($eventId, $rounds);
    if ($w = absolute_winner($st, (int)$ev['rounds'])) throw new UserError($w['name'] . ' venceu todas as rodadas: vitória absoluta, sem mesa final. Feche o evento.');
    if ($entryIds) {
        $entryIds = array_values(array_unique(array_map('intval', $entryIds)));
        if (count($entryIds) < 2 || count($entryIds) > POD_SIZE) throw new UserError('Escolha de 2 a ' . POD_SIZE . ' finalistas.');
        $valid = array_column(array_filter($st, fn($s) => !$s['dq'] && count($s['seq']) > 0), null, 'id');
        foreach ($entryIds as $id) if (!isset($valid[$id])) throw new UserError('Finalista inválido: precisa ter jogado o evento e não estar desclassificado.');
        $top = array_map(fn($id) => $valid[$id], $entryIds);
    } else {
        $top = array_slice(array_values(array_filter($st, fn($s) => !$s['dropped'] && !$s['dq'])), 0, POD_SIZE);
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('INSERT INTO rounds (event_id, number, kind) VALUES (?, ?, \'final\')', [$eventId, (int)$ev['rounds'] + 1]);
        $rid = (int)$pdo->lastInsertId();
        insert_pod($rid, 1, array_column($top, 'id'), false);
        $pdo->commit();
    } catch (Throwable $t) { $pdo->rollBack(); throw $t; }
    return $rid;
}

/* ============================================================
   Resultados
   ============================================================ */

function set_pod_result(int $podId, ?string $outcome): void {
    $pod = one('SELECT p.*, r.status AS rstatus FROM pods p JOIN rounds r ON r.id = p.round_id WHERE p.id = ?', [$podId]);
    if (!$pod) throw new UserError('Mesa não encontrada.');
    if ($pod['bye']) throw new UserError('Bye não tem resultado.');
    // Resultado de rodada fechada não muda: ele já foi usado no pareamento das rodadas seguintes
    if ($pod['rstatus'] !== 'aberta') throw new UserError('Esta rodada está fechada. Para corrigir, reabra a rodada (só é possível na última rodada gerada).');
    if ($outcome !== null && $outcome !== 'E') {
        if (!preg_match('/^V:(\d+)$/', $outcome, $m)) throw new UserError('Resultado inválido.');
        if (!one('SELECT 1 FROM seats WHERE pod_id = ? AND entry_id = ?', [$podId, (int)$m[1]])) throw new UserError('O vencedor não está nesta mesa.');
    }
    q('UPDATE pods SET result = ? WHERE id = ?', [$outcome, $podId]);
}

// Jogadores reportam; dois relatos iguais sem nenhum divergente confirmam sozinhos
function player_report(int $podId, int $entryId, string $outcome): string {
    $pod = one('SELECT p.*, r.status AS rstatus FROM pods p JOIN rounds r ON r.id = p.round_id WHERE p.id = ?', [$podId]);
    if (!$pod || $pod['bye']) throw new UserError('Mesa não encontrada.');
    if ($pod['rstatus'] !== 'aberta') throw new UserError('Essa rodada já foi fechada pela organização.');
    if (!one('SELECT 1 FROM seats WHERE pod_id = ? AND entry_id = ?', [$podId, $entryId])) throw new UserError('Você não está nesta mesa.');
    if ($outcome !== 'E' && !preg_match('/^V:(\d+)$/', $outcome)) throw new UserError('Resultado inválido.');
    if ($outcome !== 'E' && !one('SELECT 1 FROM seats WHERE pod_id = ? AND entry_id = ?', [$podId, (int)substr($outcome, 2)])) throw new UserError('O vencedor não está nesta mesa.');
    q('INSERT INTO reports (pod_id, entry_id, outcome) VALUES (?, ?, ?)
       ON CONFLICT(pod_id, entry_id) DO UPDATE SET outcome = excluded.outcome, created_at = datetime(\'now\')', [$podId, $entryId, $outcome]);
    $reps = all('SELECT outcome FROM reports WHERE pod_id = ?', [$podId]);
    $outs = array_unique(array_column($reps, 'outcome'));
    if (count($reps) >= 2 && count($outs) === 1 && $pod['result'] === null) {
        q('UPDATE pods SET result = ? WHERE id = ?', [$outcome, $podId]);
        return 'confirmado';
    }
    return count($outs) > 1 ? 'divergente' : 'pendente';
}

function close_round(int $roundId): void {
    $open = one('SELECT COUNT(*) n FROM pods WHERE round_id = ? AND bye = 0 AND result IS NULL', [$roundId]);
    if ($open['n'] > 0) throw new UserError('Ainda há ' . $open['n'] . ' mesa(s) sem resultado.');
    q('UPDATE rounds SET status = \'fechada\', closed_at = datetime(\'now\') WHERE id = ?', [$roundId]);
}

function delete_round(int $roundId): void {
    $r = one('SELECT * FROM rounds WHERE id = ?', [$roundId]);
    if (!$r) throw new UserError('Rodada não encontrada.');
    $last = one('SELECT MAX(number) m FROM rounds WHERE event_id = ?', [$r['event_id']]);
    if ((int)$last['m'] !== (int)$r['number']) throw new UserError('Só é possível desfazer a última rodada.');
    q('DELETE FROM rounds WHERE id = ?', [$roundId]);
    if (!one('SELECT 1 FROM rounds WHERE event_id = ?', [$r['event_id']])) q('UPDATE events SET status = \'inscricoes\' WHERE id = ?', [$r['event_id']]);
}

/* ============================================================
   Fechamento: colocação final, pontos de liga e histórico
   ============================================================ */

function final_placement(int $eventId): array {
    $ev = one('SELECT * FROM events WHERE id = ?', [$eventId]);
    $rounds = event_rounds($eventId);
    $st = standings($eventId, $rounds);
    $st = array_values(array_filter($st, fn($s) => !$s['dq'] && (count($s['seq']) > 0 || $s['final'] !== null)));
    $final = null;
    foreach ($rounds as $r) if ($r['kind'] === 'final') $final = $r['pods'][0] ?? null;
    $champion = null; $note = '';
    if ($final) {
        if ($final['result'] === null) throw new UserError('A mesa final ainda não tem resultado.');
        if ($final['result'] !== 'E') $champion = (int)substr($final['result'], 2);
        else {   // empate na final: campeão é o mais bem colocado no suíço (o regulamento não define)
            $ids = array_map(fn($s) => (int)$s['entry_id'], $final['seats']);
            foreach ($st as $s) if (in_array($s['id'], $ids, true)) { $champion = $s['id']; break; }
            $note = 'Final empatada: campeão definido pela classificação suíça.';
        }
    } elseif ($w = absolute_winner($st, (int)$ev['rounds'])) {
        $champion = $w['id']; $note = 'Vitória absoluta (venceu todas as rodadas, sem bye).';
    }
    $out = [];
    if ($champion) foreach ($st as $s) if ($s['id'] === $champion) $out[] = $s;
    foreach ($st as $s) if ($s['id'] !== $champion) $out[] = $s;
    foreach ($out as $i => &$s) {
        $s['pos'] = $i + 1;
        $s['ap'] = $i === 0 ? 3 : ($i < ANNUAL_TOP ? 2 : 1);
        // V-E-D do histórico inclui a mesa final (como a planilha); bye não conta
        if ($s['final'] === 'V') $s['v']++; elseif ($s['final'] === 'E') $s['e']++; elseif ($s['final'] === 'D') $s['d']++;
    }
    return ['rows' => $out, 'note' => $note, 'has_final' => (bool)$final];
}

function close_event(int $eventId): array {
    $ev = one('SELECT * FROM events WHERE id = ?', [$eventId]);
    if (!$ev) throw new UserError('Evento não encontrado.');
    if ($ev['etapa'] === null && !$ev['test']) throw new UserError('Defina a etapa do evento antes de fechar.');
    foreach (all('SELECT number, status FROM rounds WHERE event_id = ?', [$eventId]) as $r)
        if ($r['status'] !== 'fechada') throw new UserError('Feche a rodada ' . $r['number'] . ' antes.');
    $fp = final_placement($eventId);
    if ($ev['test']) {
        q('UPDATE events SET status = \'encerrado\', closed_at = datetime(\'now\') WHERE id = ?', [$eventId]);
        return $fp + ['test' => true];
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        // Substitui o que houver dessa etapa (inclusive dados provisórios importados da planilha)
        q('DELETE FROM history WHERE season = ? AND etapa = ?', [$ev['season'], $ev['etapa']]);
        foreach ($fp['rows'] as $s) {
            q('INSERT INTO history (season,etapa,date,pos,player,deck,pts,tb1,tb2,tb3,v,e,d,ap,source,event_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,\'sistema\',?)',
              [$ev['season'], $ev['etapa'], $ev['date'], $s['pos'], $s['name'], $s['deck'], $s['pts'],
               round($s['tb1'], 2), round($s['tb2'], 2), round($s['tb3'], 2), $s['v'], $s['e'], $s['d'], $s['ap'], $eventId]);
        }
        // Mesas do evento para o histórico de confrontos e conquistas
        q('DELETE FROM hist_games WHERE season = ? AND etapa = ?', [$ev['season'], $ev['etapa']]);
        foreach (event_rounds($eventId) as $r) foreach ($r['pods'] as $p) foreach ($p['seats'] as $s) {
            $res = seat_result($p, (int)$s['entry_id']);
            if ($res === null) continue;
            q('INSERT INTO hist_games (season,etapa,round,kind,pod,player,deck,result,source,event_id) VALUES (?,?,?,?,?,?,?,?,\'sistema\',?)',
              [$ev['season'], $ev['etapa'], $r['number'], $r['kind'], $p['bye'] ? 'bye' : (string)$p['table_no'], $s['name'], $s['deck'], $res, $eventId]);
        }
        q('UPDATE events SET status = \'encerrado\', closed_at = datetime(\'now\') WHERE id = ?', [$eventId]);
        $pdo->commit();
    } catch (Throwable $t) { $pdo->rollBack(); throw $t; }
    return $fp;
}

function reopen_event(int $eventId): void {
    $ev = one('SELECT * FROM events WHERE id = ?', [$eventId]);
    if (!$ev) throw new UserError('Evento não encontrado.');
    q('DELETE FROM history WHERE event_id = ?', [$eventId]);
    q('DELETE FROM hist_games WHERE event_id = ?', [$eventId]);
    q('UPDATE events SET status = \'andamento\', closed_at = NULL WHERE id = ?', [$eventId]);
}

// Troca dois jogadores de lugar numa rodada aberta (opção "permitir ajuste de rodadas")
function swap_seats(int $entryA, int $entryB, int $roundId): void {
    $r = one('SELECT r.*, e.allow_edit FROM rounds r JOIN events e ON e.id = r.event_id WHERE r.id = ?', [$roundId]);
    if (!$r) throw new UserError('Rodada não encontrada.');
    if (!$r['allow_edit']) throw new UserError('Este evento não permite ajustar as rodadas.');
    if ($r['status'] !== 'aberta') throw new UserError('Reabra a rodada para ajustar as mesas.');
    $sa = one('SELECT s.*, p.result, p.bye FROM seats s JOIN pods p ON p.id = s.pod_id WHERE p.round_id = ? AND s.entry_id = ?', [$roundId, $entryA]);
    $sb = one('SELECT s.*, p.result, p.bye FROM seats s JOIN pods p ON p.id = s.pod_id WHERE p.round_id = ? AND s.entry_id = ?', [$roundId, $entryB]);
    if (!$sa || !$sb) throw new UserError('Os dois jogadores precisam estar nesta rodada.');
    foreach ([$sa, $sb] as $x) if (!$x['bye'] && $x['result'] !== null) throw new UserError('Apague o resultado da mesa antes de trocar jogadores.');
    q('UPDATE seats SET entry_id = ? WHERE id = ?', [$entryB, $sa['id']]);
    q('UPDATE seats SET entry_id = ? WHERE id = ?', [$entryA, $sb['id']]);
    q('DELETE FROM reports WHERE pod_id IN (?, ?)', [$sa['pod_id'], $sb['pod_id']]);
}

class UserError extends RuntimeException {}
