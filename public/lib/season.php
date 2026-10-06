<?php
require_once __DIR__ . '/db.php';

// Monta os dados da temporada no mesmo formato usado pela página do ranking (objeto D):
//   pl  = ranking anual de jogadores, dk = decks, reg = registro por etapa
function season_data(int $season, ?int $upto = null): array {
    $rows = all('SELECT * FROM history WHERE season = ? AND etapa <= ? ORDER BY etapa, pos', [$season, $upto ?? 999]);
    $P = []; $K = [];
    foreach ($rows as $r) {
        $k = mb_strtolower($r['player']);
        $p = &$P[$k];
        $p ??= ['n' => $r['player'], 'pts' => 0, 'v' => 0, 'e' => 0, 'd' => 0, 'tb' => [0, 0, 0], 'ev' => 0];
        $p['pts'] += (int)($r['ap'] ?? 0);
        $p['v'] += $r['v']; $p['e'] += $r['e']; $p['d'] += $r['d'];
        $p['tb'][0] += $r['tb1']; $p['tb'][1] += $r['tb2']; $p['tb'][2] += $r['tb3'];
        $p['ev']++;
        unset($p);
        $d = &$K[$r['deck']];
        $d ??= ['n' => $r['deck'], 'v' => 0, 'e' => 0, 'd' => 0, 'pilots' => []];
        $d['v'] += $r['v']; $d['e'] += $r['e']; $d['d'] += $r['d'];
        $d['pilots'][$k] = true;
        unset($d);
    }
    // Ranking anual: pontos + vitórias/100 + médias de TB1/TB2/TB3 em casas decimais (regulamento, item 3)
    $pl = [];
    foreach ($P as $p) {
        $n = max(1, $p['ev']);
        $tb = array_map(fn($x) => round($x / $n, 2), $p['tb']);
        $dec = sprintf('%02d%03d%03d%03d', min(99, $p['v']), min(999, round($tb[0] * 100)), min(999, round($tb[1] * 100)), min(999, round($tb[2] * 100)));
        $games = $p['v'] + $p['e'] + $p['d'];
        $pl[] = ['n' => $p['n'], 'tot' => $p['pts'] . ',' . $dec, 'key' => $p['pts'] . '.' . $dec, 'pts' => (float)$p['pts'],
                 'tb1' => $tb[0], 'tb2' => $tb[1], 'tb3' => $tb[2], 'v' => $p['v'], 'e' => $p['e'], 'd' => $p['d'],
                 'wr' => $games ? round($p['v'] / $games * 100, 2) : 0.0];
    }
    usort($pl, fn($a, $b) => [bccomp_str($b['key'], $a['key']), $a['n']] <=> [0, $b['n']]);
    foreach ($pl as $i => &$p) { $p['rk'] = $i + 1; unset($p['key']); }
    unset($p);

    $dk = [];
    foreach ($K as $d) {
        $g = $d['v'] + $d['e'] + $d['d'];
        $wr = $g ? $d['v'] / $g : 0;
        $dk[] = ['n' => $d['n'], 'p' => $g, 'pts' => 3 * $d['v'] + $d['e'], 'v' => $d['v'], 'e' => $d['e'], 'd' => $d['d'],
                 'wr' => round($wr * 100, 2), 'pil' => count($d['pilots']), 'risk' => deck_risk($g, $d['v']),
                 'banned' => $g >= BAN_MIN_GAMES && $wr > BAN_WINRATE];
    }
    usort($dk, fn($a, $b) => [$b['p'], $b['wr']] <=> [$a['p'], $a['wr']]);

    $reg = array_map(fn($r) => ['et' => (int)$r['etapa'], 'pos' => (int)$r['pos'], 'j' => $r['player'], 'deck' => $r['deck'],
        'emp' => (float)$r['pts'], 'v' => (int)$r['v'], 'e' => (int)$r['e'], 'd' => (int)$r['d'], 'ap' => $r['ap'] === null ? null : (int)$r['ap'],
        'date' => $r['date']], $rows);
    return ['season' => $season, 'pl' => $pl, 'dk' => $dk, 'reg' => $reg];
}

// Compara números decimais em texto ("14.05350286268") sem perder precisão
function bccomp_str(string $a, string $b): int {
    [$ai, $af] = array_pad(explode('.', $a), 2, ''); [$bi, $bf] = array_pad(explode('.', $b), 2, '');
    if ((int)$ai !== (int)$bi) return (int)$ai <=> (int)$bi;
    $l = max(strlen($af), strlen($bf));
    return strcmp(str_pad($af, $l, '0'), str_pad($bf, $l, '0')) <=> 0;
}

// Risco de banimento por performance:
//   Banido: >= 24 partidas e win rate > 33,33%
//   Alto:   pode ser banido na próxima etapa (até 4 partidas: 3 rodadas + mesa final)
//   Médio:  >= 15 partidas, ou win rate acima de 33,33% com 9+ partidas
//   Baixo:  o resto
function deck_risk(int $games, int $wins): string {
    if ($games >= BAN_MIN_GAMES && $wins / max(1, $games) > BAN_WINRATE) return 'Banido';
    for ($extra = 1; $extra <= SWISS_ROUNDS + 1; $extra++) {
        $g = $games + $extra;
        if ($g < BAN_MIN_GAMES) continue;
        if (($wins + $extra) / $g > BAN_WINRATE) return 'Alto';
    }
    if ($games >= 15 || ($games >= 9 && $wins / $games > BAN_WINRATE)) return 'Médio';
    return 'Baixo';
}

function banned_decks(int $season): array {
    return array_values(array_map(fn($d) => $d['n'], array_filter(season_data($season)['dk'], fn($d) => $d['banned'])));
}
