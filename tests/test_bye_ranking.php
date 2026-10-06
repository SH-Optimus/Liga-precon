<?php
// Bye da rodada 1: últimos do ranking anual (desempate completo), estreantes jogam.
putenv('LIGA_DATA_DIR=' . sys_get_temp_dir() . '/liga-bye-' . getmypid());
require __DIR__ . '/../public/lib/tournament.php';
$rank = array_column(season_data(2026)['pl'], 'rk', 'n');
function run(array $names, int $seed): array {
    q("INSERT INTO events (title, season, etapa) VALUES ('t', 2026, 99)");
    $ev = (int)db()->lastInsertId();
    foreach ($names as $n) {
        q('INSERT OR IGNORE INTO players (name) VALUES (?)', [$n]);
        q('INSERT INTO entries (event_id, player_id, deck, checked_in) VALUES (?, (SELECT id FROM players WHERE name = ?), \'x\', 1)', [$ev, $n]);
    }
    generate_swiss_round($ev, $seed);
    $r = event_rounds($ev)[0];
    $bye = [];
    foreach ($r['pods'] as $p) if ($p['bye']) foreach ($p['seats'] as $s) $bye[] = $s['name'];
    return $bye;
}
$fail = 0;
// 17 jogadores (1 bye): inclui 2 estreantes e jogadores do fim do ranking
$names = ['Morkan','Fabio C','Crothen','Yasmin','Erickpd','Campera','Lanna','Bydo','Gabriel P.','caiobmbh','Karyum',
          'Henrique','Skeeter','Eduardo Bachman','Andre rezende','Estreante A','Estreante B'];
$worst = array_slice(array_values(array_filter(array_keys($rank), fn($n) => in_array($n, $names, true))), -3);
printf("Últimos do ranking entre os presentes: %s\n", implode(', ', array_map(fn($n) => "$n ({$rank[$n]}º)", $worst)));
foreach ([1, 2, 3] as $seed) {
    $b = run($names, $seed);
    $ok = $b === [end($worst)];
    printf("%s 17 jogadores, sorteio %d: bye = %s\n", $ok ? 'ok ' : 'ERR', $seed, implode(', ', $b)); $fail += !$ok;
}
// 19 jogadores (3 byes): os 3 últimos do ranking
$names19 = array_merge($names, ['Pedro Jawa', 'Matheus Pereira']);
$w3 = array_slice(array_values(array_filter(array_keys($rank), fn($n) => in_array($n, $names19, true))), -3);
$b = run($names19, 5); sort($b); $e = $w3; sort($e);
printf("%s 19 jogadores: byes = %s (esperado %s)\n", $b === $e ? 'ok ' : 'ERR', implode(', ', $b), implode(', ', $e)); $fail += $b !== $e;
// Só estreantes sobrando: estreante pode receber bye
$b = run(['Estreante A','Estreante B','Estreante C','Estreante D','Estreante E'], 9);
printf("%s 5 estreantes: bye = %s\n", count($b) === 1 && str_starts_with($b[0], 'Estreante') ? 'ok ' : 'ERR', implode(', ', $b));
echo $fail ? "FALHOU\n" : "OK\n"; exit($fail ? 1 : 0);
