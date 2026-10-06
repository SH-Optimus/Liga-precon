<?php
require_once __DIR__ . '/season.php';

// Catálogo de conquistas: id => [nome, descrição, grupo, ícone, repetível]
const ACHIEVEMENTS = [
    'primeiro_sangue'  => ['Primeiro Sangue', 'Primeira vitória numa mesa da liga', 'Vitórias', '🩸', false],
    'campeao'          => ['Campeão da Etapa', 'Venceu uma etapa', 'Vitórias', '🏆', true],
    'coroa_tripla'     => ['Coroa Tripla', 'Venceu as 3 rodadas suíças de uma etapa', 'Vitórias', '👑', false],
    'vitoria_absoluta' => ['Vitória Absoluta', 'Campeão direto, sem mesa final', 'Vitórias', '⚡', false],
    'rei_mesa_final'   => ['Rei da Mesa Final', 'Chegou a 3 mesas finais', 'Vitórias', '🎖️', false],
    'sequencia_mortal' => ['Sequência Mortal', '3 vitórias seguidas, mesmo entre etapas', 'Vitórias', '🔥', false],
    'virada'           => ['Virada', 'Perdeu a 1ª rodada e chegou à mesa final na mesma etapa', 'Vitórias', '↩️', false],
    'colecionador'     => ['Colecionador', 'Jogou com 5 decks diferentes', 'Decks', '🗃️', false],
    'mestre_de_muitos' => ['Mestre de Muitos', 'Venceu com 3 decks diferentes', 'Decks', '🎭', false],
    'fiel'             => ['Fiel ao Comandante', 'Jogou o mesmo deck em 4 etapas', 'Decks', '🛡️', false],
    'azarao'           => ['Azarão', 'Venceu com um deck de win rate abaixo de 15% na liga', 'Decks', '🐴', false],
    'pioneiro'         => ['Pioneiro', 'Primeiro a levar um deck novo para a liga', 'Decks', '🧭', false],
    'cacador'          => ['Caçador de Gigantes', 'Venceu uma mesa com um deck em risco alto ou banido', 'Decks', '🗡️', false],
    'estreia'          => ['Estreia', 'Jogou a primeira etapa', 'Presença', '🎟️', false],
    'veterano'         => ['Veterano', 'Jogou 5 etapas na temporada', 'Presença', '🎒', false],
    'presenca_ferro'   => ['Presença de Ferro', 'Jogou todas as etapas da temporada até agora', 'Presença', '⛓️', false],
    'social'           => ['Social', 'Enfrentou 30 jogadores diferentes', 'Presença', '🤝', false],
    'pacificador'      => ['Pacificador', '10 empates (o tempo é amigo de quem sobrevive)', 'Presença', '🕊️', false],
    'sorte_bye'        => ['Sorte do Bye', 'Recebeu 3 byes', 'Presença', '🍀', false],
    'nemesis'          => ['Nêmesis', 'Venceu o mesmo jogador 3 vezes', 'Rivalidades', '😈', false],
    'vinganca'         => ['Vingança', 'Venceu alguém que já tinha te vencido', 'Rivalidades', '⚔️', false],
    'matador_lider'    => ['Matador de Líder', 'Venceu uma mesa com o 1º do ranking anual', 'Rivalidades', '🎯', false],
    'top10'            => ['Top 10', 'Ficou no top 10 do ranking anual depois de uma etapa', 'Ranking', '🔟', false],
    'lider'            => ['Líder', 'Foi o 1º do ranking anual depois de uma etapa', 'Ranking', '🥇', false],
    'escalada'         => ['Escalada', 'Subiu 10 posições no ranking de uma etapa para a outra', 'Ranking', '📈', false],
];

function rarity(float $pct): string {
    return $pct < 5 ? 'mitica' : ($pct < 20 ? 'rara' : ($pct < 50 ? 'incomum' : 'comum'));
}

// Calcula perfis e conquistas de todos os jogadores da temporada (uma vez por requisição)
function season_profiles(int $season): array {
    static $cache = [];
    if (isset($cache[$season])) return $cache[$season];
    $H = all('SELECT * FROM history WHERE season = ? ORDER BY etapa, pos', [$season]);
    $G = all('SELECT * FROM hist_games WHERE season = ? ORDER BY etapa, round, pod, id', [$season]);
    $low = fn($s) => mb_strtolower(trim($s));
    $etapas = array_values(array_unique(array_merge(array_map(fn($r) => (int)$r['etapa'], $H), array_map(fn($r) => (int)$r['etapa'], $G))));
    sort($etapas);
    $full = season_data($season);
    $deckInfo = []; foreach ($full['dk'] as $d) $deckInfo[$low($d['n'])] = $d;

    // Ranking anual depois de cada etapa
    $rankAfter = [];
    foreach ($etapas as $e) {
        $rankAfter[$e] = [];
        foreach (season_data($season, $e)['pl'] as $p) $rankAfter[$e][$low($p['n'])] = ['rk' => $p['rk'], 'pts' => $p['pts']];
    }
    // Nome oficial (como no ranking)
    $names = [];
    foreach ($H as $r) $names[$low($r['player'])] = $r['player'];
    foreach ($G as $r) $names[$low($r['player'])] ??= $r['player'];

    // Mesas agrupadas
    $pods = [];   // [etapa][round][pod] => linhas
    foreach ($G as $g) $pods[(int)$g['etapa']][(int)$g['round']][$g['pod']][] = $g;
    $histBy = []; foreach ($H as $r) $histBy[(int)$r['etapa']][$low($r['player'])] = $r;

    $P = [];
    $init = fn($k) => ['wins' => 0, 'draws' => 0, 'byes' => 0, 'finals' => 0, 'streak' => 0, 'decks' => [], 'winDecks' => [],
        'deckEtapas' => [], 'opps' => [], 'beat' => [], 'beatenBy' => [], 'etapas' => [], 'ach' => [], 'h2h' => []];
    $unlock = function (&$p, string $id, int $e) {
        if (ACHIEVEMENTS[$id][4]) { $p['ach'][$id] ??= ['etapas' => []]; if (!in_array($e, $p['ach'][$id]['etapas'], true)) $p['ach'][$id]['etapas'][] = $e; }
        elseif (!isset($p['ach'][$id])) $p['ach'][$id] = ['etapas' => [$e]];
    };
    $seenDecks = [];
    foreach ($etapas as $i => $e) {
        $prevLeader = null;
        if ($i > 0) foreach ($rankAfter[$etapas[$i - 1]] as $k => $x) if ($x['rk'] === 1) $prevLeader = $k;
        $finalists = [];
        foreach ($pods[$e] ?? [] as $rn => $byPod) foreach ($byPod as $pod => $rows) {
            $isFinal = $rows[0]['kind'] === 'final';
            $ks = array_map(fn($r) => $low($r['player']), $rows);
            foreach ($rows as $r) {
                $k = $low($r['player']); $P[$k] ??= $init($k); $p = &$P[$k];
                $p['etapas'][$e] = true;
                $deck = $low($r['deck']);
                if ($r['deck'] !== '') { $p['decks'][$deck] = $r['deck']; $p['deckEtapas'][$deck][$e] = true; }
                if ($r['result'] === 'B') { $p['byes']++; unset($p); continue; }
                if ($isFinal) { $p['finals']++; $finalists[$k] = true; }
                $winner = null; foreach ($rows as $o) if ($o['result'] === 'V') $winner = $low($o['player']);
                foreach ($ks as $o) if ($o !== $k) {
                    $p['opps'][$o] = true;
                    $h = &$p['h2h'][$o];
                    $h ??= ['n' => 0, 'v' => 0, 'd' => 0, 'e' => 0, 'x' => 0];
                    $h['n']++;
                    if ($r['result'] === 'V') $h['v']++; elseif ($r['result'] === 'E') $h['e']++; elseif ($winner === $o) $h['d']++; else $h['x']++;
                    unset($h);
                }
                if ($r['result'] === 'V') {
                    $p['wins']++; $p['streak']++; $p['winDecks'][$deck] = true;
                    $unlock($p, 'primeiro_sangue', $e);
                    if ($p['streak'] >= 3) $unlock($p, 'sequencia_mortal', $e);
                    foreach ($ks as $o) if ($o !== $k) {
                        $p['beat'][$o] = ($p['beat'][$o] ?? 0) + 1;
                        if ($p['beat'][$o] >= 3) $unlock($p, 'nemesis', $e);
                        if (isset($p['beatenBy'][$o])) $unlock($p, 'vinganca', $e);
                        if ($o === $prevLeader) $unlock($p, 'matador_lider', $e);
                    }
                    $di = $deckInfo[$deck] ?? null;
                    if ($di && $di['p'] >= 6 && $di['wr'] < 15) $unlock($p, 'azarao', $e);
                    foreach ($rows as $o) if ($low($o['player']) !== $k) {
                        $od = $deckInfo[$low($o['deck'])] ?? null;
                        if ($od && in_array($od['risk'], ['Alto', 'Banido'], true)) $unlock($p, 'cacador', $e);
                    }
                } else {
                    $p['streak'] = 0;
                    if ($r['result'] === 'E') $p['draws']++;
                    if ($r['result'] === 'D' && $winner) $p['beatenBy'][$winner] = true;
                }
                unset($p);
            }
        }
        // Verificações ao fim da etapa
        $hasFinal = !empty($finalists);
        foreach ($P as $k => &$p) {
            if (!isset($p['etapas'][$e])) continue;
            $res = [];
            foreach ($pods[$e] ?? [] as $rn => $byPod) foreach ($byPod as $rows) foreach ($rows as $r) if ($low($r['player']) === $k) $res[$rn] = $r['result'];
            $h = $histBy[$e][$k] ?? null;
            $tri = ($res[1] ?? '') === 'V' && ($res[2] ?? '') === 'V' && ($res[3] ?? '') === 'V';
            if ($tri) $unlock($p, 'coroa_tripla', $e);
            if ($h && (int)$h['pos'] === 1 && $h['ap'] !== null) {
                $unlock($p, 'campeao', $e);
                if (!$hasFinal && $tri) $unlock($p, 'vitoria_absoluta', $e);
            }
            if ($p['finals'] >= 3) $unlock($p, 'rei_mesa_final', $e);
            if (($res[1] ?? '') === 'D' && isset($finalists[$k])) $unlock($p, 'virada', $e);
            if (count($p['decks']) >= 5) $unlock($p, 'colecionador', $e);
            if (count($p['winDecks']) >= 3) $unlock($p, 'mestre_de_muitos', $e);
            foreach ($p['deckEtapas'] as $de) if (count($de) >= 4) { $unlock($p, 'fiel', $e); break; }
            if ($i > 0) foreach ($p['deckEtapas'] as $dk => $de) if (isset($de[$e]) && !isset($seenDecks[$dk])) { $unlock($p, 'pioneiro', $e); break; }
            $unlock($p, 'estreia', $e);
            if (count($p['etapas']) >= 5) $unlock($p, 'veterano', $e);
            if (count($p['opps']) >= 30) $unlock($p, 'social', $e);
            if ($p['draws'] >= 10) $unlock($p, 'pacificador', $e);
            if ($p['byes'] >= 3) $unlock($p, 'sorte_bye', $e);
        }
        unset($p);
        foreach ($P as $k => &$p) {   // ranking depois da etapa
            $now = $rankAfter[$e][$k]['rk'] ?? null;
            if ($now === null) continue;
            if ($now <= 10) $unlock($p, 'top10', $e);
            if ($now === 1) $unlock($p, 'lider', $e);
            $before = $i > 0 ? ($rankAfter[$etapas[$i - 1]][$k]['rk'] ?? null) : null;
            if ($before !== null && $before - $now >= 10) $unlock($p, 'escalada', $e);
        }
        unset($p);
        foreach ($P as $p) foreach ($p['deckEtapas'] as $dk => $de) if (isset($de[$e])) $seenDecks[$dk] = true;
    }
    // Presença de Ferro: status atual (jogou todas as etapas até agora)
    $last = $etapas ? end($etapas) : 0;
    foreach ($P as &$p) if (count($etapas) >= 3 && count($p['etapas']) === count($etapas)) $p['ach']['presenca_ferro'] = ['etapas' => [$last]];
    unset($p);

    // Raridade e destaques por etapa
    $nPlayers = max(1, count(array_filter($P, fn($p) => !empty($p['etapas']))));
    $catalog = []; $feed = [];
    foreach (ACHIEVEMENTS as $id => [$nome, $desc, $grupo, $icon, $rep]) {
        $holders = [];
        foreach ($P as $k => $p) if (isset($p['ach'][$id])) $holders[] = $names[$k] ?? $k;
        $pct = round(count($holders) / $nPlayers * 100, 1);
        $catalog[$id] = ['id' => $id, 'nome' => $nome, 'desc' => $desc, 'grupo' => $grupo, 'icon' => $icon, 'repetivel' => $rep,
                         'pct' => $pct, 'raridade' => rarity($pct), 'holders' => $holders];
    }
    foreach ($P as $k => $p) foreach ($p['ach'] as $id => $a) {
        if ($id === 'presenca_ferro') continue;
        $first = $a['etapas'][0];
        $feed[$first][] = ['player' => $names[$k] ?? $k, 'id' => $id];
        if (ACHIEVEMENTS[$id][4]) foreach (array_slice($a['etapas'], 1) as $e2) $feed[$e2][] = ['player' => $names[$k] ?? $k, 'id' => $id, 'repeat' => true];
    }
    krsort($feed);
    return $cache[$season] = ['P' => $P, 'names' => $names, 'catalog' => $catalog, 'feed' => $feed, 'etapas' => $etapas,
                              'rankAfter' => $rankAfter, 'full' => $full, 'histBy' => $histBy, 'deckInfo' => $deckInfo, 'nPlayers' => $nPlayers];
}

function player_profile(int $season, string $name): ?array {
    $S = season_profiles($season);
    $k = mb_strtolower(trim($name));
    if (!isset($S['P'][$k]) && !isset($S['names'][$k])) return null;
    $p = $S['P'][$k] ?? null;
    $pl = null; foreach ($S['full']['pl'] as $x) if (mb_strtolower($x['n']) === $k) $pl = $x;
    $tenth = $S['full']['pl'][9] ?? null;
    $evo = [];
    foreach ($S['etapas'] as $e) {
        $h = $S['histBy'][$e][$k] ?? null;
        $evo[] = ['etapa' => $e, 'played' => (bool)$h, 'pos' => $h ? (int)$h['pos'] : null, 'n' => count($S['histBy'][$e] ?? []),
                  'deck' => $h['deck'] ?? null, 'ap' => $h && $h['ap'] !== null ? (int)$h['ap'] : null,
                  'v' => $h ? (int)$h['v'] : 0, 'e' => $h ? (int)$h['e'] : 0, 'd' => $h ? (int)$h['d'] : 0,
                  'pts' => $S['rankAfter'][$e][$k]['pts'] ?? null, 'rk' => $S['rankAfter'][$e][$k]['rk'] ?? null];
    }
    // Decks (pelo histórico de etapas: inclui mesa final, sem byes)
    $decks = [];
    foreach ($S['histBy'] as $e => $rows) if (isset($rows[$k])) {
        $r = $rows[$k]; $dk = $r['deck'];
        $d = &$decks[$dk]; $d ??= ['deck' => $dk, 'etapas' => 0, 'v' => 0, 'e' => 0, 'd' => 0, 'titulos' => 0];
        $d['etapas']++; $d['v'] += $r['v']; $d['e'] += $r['e']; $d['d'] += $r['d'];
        if ((int)$r['pos'] === 1 && $r['ap'] !== null) $d['titulos']++;
        unset($d);
    }
    foreach ($decks as &$d) {
        $g = $d['v'] + $d['e'] + $d['d']; $d['wr'] = $g ? round($d['v'] / $g * 100, 1) : 0;
        $li = $S['deckInfo'][mb_strtolower($d['deck'])] ?? null; $d['liga_wr'] = $li['wr'] ?? null; $d['risk'] = $li['risk'] ?? null;
    }
    unset($d);
    $decks = array_values($decks);
    usort($decks, fn($a, $b) => [$b['etapas'], $b['wr']] <=> [$a['etapas'], $a['wr']]);
    $h2h = [];
    foreach ($p['h2h'] ?? [] as $o => $h) $h2h[] = ['nome' => $S['names'][$o] ?? $o] + $h;
    usort($h2h, fn($a, $b) => [$b['n'], $b['v']] <=> [$a['n'], $a['v']]);
    $ach = [];
    foreach ($p['ach'] ?? [] as $id => $a) $ach[] = $S['catalog'][$id] + ['etapas' => $a['etapas']];
    usort($ach, fn($a, $b) => $a['pct'] <=> $b['pct']);
    foreach ($ach as &$a) unset($a['holders']);
    unset($a);
    return [
        'nome' => $S['names'][$k] ?? $name, 'season' => $season,
        'ranking' => $pl, 'total_jogadores' => count($S['full']['pl']),
        'top10' => $tenth ? ['pts' => $tenth['pts'], 'nome' => $tenth['n']] : null,
        'evolucao' => $evo, 'decks' => $decks, 'h2h' => $h2h, 'conquistas' => $ach,
        'faltam' => array_values(array_map(fn($c) => array_diff_key($c, ['holders' => 1]), array_filter($S['catalog'], fn($c) => !isset($p['ach'][$c['id']])))),
        'byes' => $p['byes'] ?? 0, 'oponentes' => count($p['opps'] ?? []),
    ];
}

function achievements_overview(int $season): array {
    $S = season_profiles($season);
    $feed = [];
    foreach ($S['feed'] as $e => $items) $feed[] = ['etapa' => $e, 'items' => $items];
    return ['catalog' => array_values($S['catalog']), 'feed' => $feed, 'jogadores' => $S['nPlayers']];
}
