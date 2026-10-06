<?php
require_once __DIR__ . '/season.php';

// Confrontos deck × deck a partir das mesas (inclui a mesa final; byes e espelhos não contam;
// dois pilotos do mesmo deck na mesa contam como um).
// Para cada par: n = mesas juntos, w = vitórias do deck, l = vitórias do outro, e = empates, x = um terceiro venceu.
function deck_matchups(int $season): array {
    static $cache = [];
    if (isset($cache[$season])) return $cache[$season];
    $pods = [];
    foreach (all("SELECT * FROM hist_games WHERE season = ? AND pod <> 'bye' ORDER BY etapa, round, pod, id", [$season]) as $g)
        $pods[$g['etapa'] . '|' . $g['round'] . '|' . $g['pod']][] = $g;
    $M = []; $meet = [];
    foreach ($pods as $key => $rows) {
        $winner = null; foreach ($rows as $r) if ($r['result'] === 'V') $winner = $r;
        $draw = !$winner && count(array_filter($rows, fn($r) => $r['result'] === 'E')) === count($rows);
        [$et, $rn, $pod] = explode('|', $key);
        $info = ['etapa' => (int)$et, 'round' => (int)$rn, 'pod' => $pod, 'final' => $rows[0]['kind'] === 'final',
                 'rows' => array_map(fn($r) => ['player' => $r['player'], 'deck' => $r['deck'], 'result' => $r['result']], $rows)];
        // Cada par de decks conta uma vez por mesa, mesmo com dois pilotos do mesmo deck (como a planilha da organização)
        $decks = array_values(array_unique(array_filter(array_map(fn($r) => $r['deck'], $rows), fn($d) => $d !== '')));
        $W = $winner['deck'] ?? null;
        foreach ($decks as $A) foreach ($decks as $B) {
            if ($A === $B) continue;
            $c = &$M[$A][$B];
            $c ??= ['n' => 0, 'w' => 0, 'l' => 0, 'e' => 0, 'x' => 0];
            $c['n']++;
            if ($draw) $c['e']++;
            elseif ($W === $A) $c['w']++;
            elseif ($W === $B) $c['l']++;
            else $c['x']++;
            unset($c);
            $meet[$A][$B][$key] = $info;
        }
    }
    return $cache[$season] = ['M' => $M, 'meet' => $meet];
}

function decks_overview(int $season): array {
    $sd = season_data($season);
    $titles = [];
    foreach (all('SELECT deck, COUNT(*) n FROM history WHERE season = ? AND pos = 1 AND ap IS NOT NULL GROUP BY deck', [$season]) as $r) $titles[$r['deck']] = (int)$r['n'];
    $list = array_map(fn($d) => $d + ['titulos' => $titles[$d['n']] ?? 0], $sd['dk']);
    $mu = deck_matchups($season)['M'];
    $cells = [];
    foreach ($mu as $a => $row) foreach ($row as $b => $c) $cells[$a][$b] = [$c['w'] - $c['l'], $c['n'], $c['w'], $c['l'], $c['e']];
    return ['season' => $season, 'decks' => $list, 'cells' => $cells];
}

function deck_page(int $season, string $name): ?array {
    $sd = season_data($season);
    $low = mb_strtolower(trim($name));
    $d = null; foreach ($sd['dk'] as $x) if (mb_strtolower($x['n']) === $low) $d = $x;
    if (!$d) return null;
    $deck = $d['n'];
    $H = all('SELECT * FROM history WHERE season = ? AND deck = ? ORDER BY etapa, pos', [$season, $deck]);
    $nEt = []; foreach (all('SELECT etapa, COUNT(*) n FROM history WHERE season = ? GROUP BY etapa', [$season]) as $r) $nEt[(int)$r['etapa']] = (int)$r['n'];
    $pil = []; $evo = []; $titles = [];
    foreach ($H as $r) {
        $p = &$pil[mb_strtolower($r['player'])];
        $p ??= ['nome' => $r['player'], 'etapas' => 0, 'v' => 0, 'e' => 0, 'd' => 0, 'melhor' => null];
        $p['etapas']++; $p['v'] += $r['v']; $p['e'] += $r['e']; $p['d'] += $r['d'];
        $p['melhor'] = $p['melhor'] === null ? (int)$r['pos'] : min($p['melhor'], (int)$r['pos']);
        unset($p);
        $e = &$evo[(int)$r['etapa']];
        $e ??= ['etapa' => (int)$r['etapa'], 'pilotos' => 0, 'v' => 0, 'e' => 0, 'd' => 0, 'melhor' => null, 'n' => $nEt[(int)$r['etapa']] ?? 0];
        $e['pilotos']++; $e['v'] += $r['v']; $e['e'] += $r['e']; $e['d'] += $r['d'];
        $e['melhor'] = $e['melhor'] === null ? (int)$r['pos'] : min($e['melhor'], (int)$r['pos']);
        unset($e);
        if ((int)$r['pos'] === 1 && $r['ap'] !== null) $titles[] = ['etapa' => (int)$r['etapa'], 'piloto' => $r['player']];
    }
    $pil = array_values($pil);
    foreach ($pil as &$p) { $g = $p['v'] + $p['e'] + $p['d']; $p['wr'] = $g ? round($p['v'] / $g * 100, 1) : 0; }
    unset($p);
    usort($pil, fn($a, $b) => [$b['etapas'], $b['wr']] <=> [$a['etapas'], $a['wr']]);
    // win rate acumulado depois de cada etapa
    $evo = array_values($evo); $cv = $cg = 0;
    foreach ($evo as &$e) { $cv += $e['v']; $cg += $e['v'] + $e['e'] + $e['d']; $e['jogos'] = $cg; $e['wr_acum'] = $cg ? round($cv / $cg * 100, 1) : 0; }
    unset($e);
    $mu = deck_matchups($season);
    $rows = [];
    foreach ($mu['M'][$deck] ?? [] as $o => $c) $rows[] = ['deck' => $o, 'saldo' => $c['w'] - $c['l']] + $c + ['mesas' => array_values($mu['meet'][$deck][$o] ?? [])];
    usort($rows, fn($a, $b) => [$b['n'], $b['saldo']] <=> [$a['n'], $a['saldo']]);
    $by = fn($sign) => array_slice(array_values(array_filter($rows, fn($r) => $sign * $r['saldo'] > 0)), 0, 99);
    $best = $by(1); usort($best, fn($a, $b) => [$b['saldo'], $b['n']] <=> [$a['saldo'], $a['n']]);
    $worst = $by(-1); usort($worst, fn($a, $b) => [$a['saldo'], $b['n']] <=> [$b['saldo'], $a['n']]);
    $strip = fn($r) => array_diff_key($r, ['mesas' => 1]);
    return ['nome' => $deck, 'season' => $season, 'stats' => $d + ['titulos' => count($titles)], 'titulos' => $titles,
            'pilotos' => $pil, 'evolucao' => $evo, 'confrontos' => $rows,
            'favoraveis' => array_map($strip, array_slice($best, 0, 3)), 'desfavoraveis' => array_map($strip, array_slice($worst, 0, 3)),
            'regra_ban' => ['min' => BAN_MIN_GAMES, 'wr' => round(BAN_WINRATE * 100, 2)]];
}
