<?php
require_once __DIR__ . '/tournament.php';

/* ============================================================
   Mesa final em outro dia
   ============================================================ */

// Evento do sistema com as rodadas suíças encerradas e a final para outro dia:
// publica a etapa no histórico como "final pendente" (sem pontos de liga), como acontece com a planilha.
// Ao fechar o evento depois da final, essas linhas são substituídas pelo resultado completo.
function publish_swiss(int $eventId): array {
    $ev = one('SELECT * FROM events WHERE id = ?', [$eventId]);
    if (!$ev) throw new UserError('Evento não encontrado.');
    if ($ev['test']) throw new UserError('Evento de teste não entra no ranking.');
    if ($ev['etapa'] === null) throw new UserError('Defina a etapa do evento antes.');
    $rounds = event_rounds($eventId);
    $swiss = array_filter($rounds, fn($r) => $r['kind'] === 'suico');
    if (count($swiss) < (int)$ev['rounds']) throw new UserError('Termine as ' . $ev['rounds'] . ' rodadas suíças antes.');
    foreach ($swiss as $r) if ($r['status'] !== 'fechada') throw new UserError('Feche a rodada ' . $r['number'] . ' antes.');
    $st = array_values(array_filter(standings($eventId, $rounds), fn($s) => !$s['dq'] && count($s['seq']) > 0));
    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('DELETE FROM history WHERE season = ? AND etapa = ?', [$ev['season'], $ev['etapa']]);
        q('DELETE FROM hist_games WHERE season = ? AND etapa = ?', [$ev['season'], $ev['etapa']]);
        foreach ($st as $i => $s)
            q('INSERT INTO history (season,etapa,date,pos,player,deck,pts,tb1,tb2,tb3,v,e,d,ap,source,event_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,\'sistema\',?)',
              [$ev['season'], $ev['etapa'], $ev['date'], $i + 1, $s['name'], $s['deck'], $s['pts'], round($s['tb1'], 2), round($s['tb2'], 2), round($s['tb3'], 2), $s['v'], $s['e'], $s['d'], $eventId]);
        foreach ($swiss as $r) foreach ($r['pods'] as $p) foreach ($p['seats'] as $seat) {
            $res = seat_result($p, (int)$seat['entry_id']);
            if ($res === null) continue;
            q('INSERT INTO hist_games (season,etapa,round,kind,pod,player,deck,result,source,event_id) VALUES (?,?,?,\'suico\',?,?,?,?,\'sistema\',?)',
              [$ev['season'], $ev['etapa'], $r['number'], $p['bye'] ? 'bye' : (string)$p['table_no'], $seat['name'], $seat['deck'], $res, $eventId]);
        }
        $pdo->commit();
    } catch (Throwable $t) { $pdo->rollBack(); throw $t; }
    return ['jogadores' => count($st)];
}

// Etapas no histórico com final pendente que não pertencem a um evento do sistema (ex.: importadas da planilha/EMP)
function imported_finals(int $season): array {
    $out = [];
    $rows = all('SELECT * FROM history WHERE season = ? AND event_id IS NULL ORDER BY etapa, pos', [$season]);
    $by = []; foreach ($rows as $r) $by[(int)$r['etapa']][] = $r;
    foreach ($by as $e => $rs) {
        $pending = count(array_filter($rs, fn($r) => $r['ap'] === null)) > 0;
        $manual = $rs[0]['source'] === 'sistema';   // final lançada manualmente pelo painel
        if (!$pending && !$manual) continue;
        $fin = array_column(all("SELECT player, result FROM hist_games WHERE season = ? AND etapa = ? AND kind = 'final'", [$season, $e]), 'result', 'player');
        $out[] = ['etapa' => $e, 'date' => $rs[0]['date'], 'pendente' => $pending,
                  'jogadores' => array_map(fn($r) => ['nome' => $r['player'], 'deck' => $r['deck'], 'pos' => (int)$r['pos'], 'pts' => (float)$r['pts'], 'final' => $fin[$r['player']] ?? null], $rs)];
    }
    return $out;
}

// Lança a mesa final de uma etapa importada: $finalists = nomes (2 a 4), $outcome = nome do vencedor ou 'E' (empate)
function finalize_imported(int $season, int $etapa, array $finalists, string $outcome): array {
    $rows = all('SELECT * FROM history WHERE season = ? AND etapa = ? AND event_id IS NULL ORDER BY pos', [$season, $etapa]);
    if (!$rows) throw new UserError('Etapa não encontrada no histórico.');
    $byName = []; foreach ($rows as $r) $byName[mb_strtolower($r['player'])] = $r;
    $fin = [];
    foreach ($finalists as $n) {
        $k = mb_strtolower(trim((string)$n));
        if ($k === '') continue;
        if (!isset($byName[$k])) throw new UserError("$n não jogou a Etapa " . sprintf('%02d', $etapa) . '.');
        $fin[$k] = $byName[$k];
    }
    if (count($fin) < 2 || count($fin) > POD_SIZE) throw new UserError('Escolha de 2 a ' . POD_SIZE . ' finalistas diferentes.');
    $draw = $outcome === 'E';
    $win = $draw ? null : mb_strtolower(trim($outcome));
    if (!$draw && !isset($fin[$win])) throw new UserError('O vencedor precisa ser um dos finalistas.');
    // Campeão: vencedor da final (no empate, o mais bem colocado no suíço). Depois os outros finalistas e o resto, na ordem do suíço.
    $finOrder = array_values($fin); usort($finOrder, fn($a, $b) => (int)$a['pos'] <=> (int)$b['pos']);
    $champ = $draw ? mb_strtolower($finOrder[0]['player']) : $win;
    $order = [$fin[$champ]];
    foreach ($finOrder as $r) if (mb_strtolower($r['player']) !== $champ) $order[] = $r;
    foreach ($rows as $r) if (!isset($fin[mb_strtolower($r['player'])])) $order[] = $r;
    $pdo = db();
    $pdo->beginTransaction();
    try {
        // Desfaz uma final lançada antes, se houver (V-E-D volta ao suíço)
        foreach (all("SELECT player, result FROM hist_games WHERE season = ? AND etapa = ? AND kind = 'final'", [$season, $etapa]) as $g) {
            $col = ['V' => 'v', 'E' => 'e', 'D' => 'd'][$g['result']] ?? null;
            if ($col) q("UPDATE history SET $col = $col - 1 WHERE season = ? AND etapa = ? AND player = ? AND event_id IS NULL", [$season, $etapa, $g['player']]);
        }
        q("DELETE FROM hist_games WHERE season = ? AND etapa = ? AND kind = 'final'", [$season, $etapa]);
        foreach ($order as $i => $r) {
            $k = mb_strtolower($r['player']);
            $res = isset($fin[$k]) ? ($draw ? 'E' : ($k === $win ? 'V' : 'D')) : null;
            $ap = $i === 0 ? 3 : ($i < ANNUAL_TOP ? 2 : 1);
            $col = $res ? ['V' => 'v', 'E' => 'e', 'D' => 'd'][$res] : null;
            q('UPDATE history SET pos = ?, ap = ?, source = \'sistema\'' . ($col ? ", $col = $col + 1" : '') . ' WHERE id = ?', [$i + 1, $ap, $r['id']]);
            if ($res) q('INSERT INTO hist_games (season,etapa,round,kind,pod,player,deck,result,source) VALUES (?,?,4,\'final\',\'1\',?,?,?,\'sistema\')',
                        [$season, $etapa, $r['player'], $r['deck'], $res]);
        }
        // A etapa passa a ser mantida pelo sistema (o botão de recarregar a planilha não a sobrescreve)
        q("UPDATE hist_games SET source = 'sistema' WHERE season = ? AND etapa = ?", [$season, $etapa]);
        $pdo->commit();
    } catch (Throwable $t) { $pdo->rollBack(); throw $t; }
    return ['campeao' => $order[0]['player'], 'empate' => $draw];
}

// Volta a etapa ao estado importado da planilha (final pendente, como estava)
function undo_imported_final(int $season, int $etapa): void {
    if (one('SELECT 1 FROM history WHERE season = ? AND etapa = ? AND event_id IS NOT NULL', [$season, $etapa]))
        throw new UserError('Esta etapa pertence a um evento do sistema: reabra o evento.');
    $hist = array_values(array_filter(json_decode(@file_get_contents(__DIR__ . '/seed.json') ?: '[]', true) ?: [], fn($r) => $r['season'] === $season && $r['etapa'] === $etapa));
    if (!$hist) throw new UserError('A etapa não está nos dados da planilha que vieram com o pacote.');
    $games = array_filter(json_decode(@file_get_contents(__DIR__ . '/seed_games.json') ?: '[]', true) ?: [], fn($g) => $g['season'] === $season && $g['etapa'] === $etapa);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('DELETE FROM history WHERE season = ? AND etapa = ?', [$season, $etapa]);
        q('DELETE FROM hist_games WHERE season = ? AND etapa = ?', [$season, $etapa]);
        foreach ($hist as $r) q('INSERT INTO history (season,etapa,date,pos,player,deck,pts,tb1,tb2,tb3,v,e,d,ap,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,\'planilha\')',
            [$r['season'], $r['etapa'], $r['date'], $r['pos'], $r['player'], $r['deck'], $r['pts'], $r['tb1'], $r['tb2'], $r['tb3'], $r['v'], $r['e'], $r['d'], $r['ap']]);
        foreach ($games as $g) q('INSERT INTO hist_games (season,etapa,round,kind,pod,player,deck,result,source) VALUES (?,?,?,?,?,?,?,?,\'planilha\')',
            [$g['season'], $g['etapa'], $g['round'], $g['kind'], $g['pod'], $g['player'], $g['deck'], $g['result']]);
        $pdo->commit();
    } catch (Throwable $t) { $pdo->rollBack(); throw $t; }
}
