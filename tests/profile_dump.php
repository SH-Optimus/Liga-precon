<?php
putenv('LIGA_DATA_DIR=' . sys_get_temp_dir() . '/liga-prof-' . getmypid());
require __DIR__ . '/../public/lib/profile.php';
$t = microtime(true);
$o = achievements_overview(2026);
printf("tempo: %.2fs | jogadores: %d\n", microtime(true) - $t, $o['jogadores']);
foreach ($o['catalog'] as $c) printf("%-18s %-8s %5.1f%%  %s\n", $c['nome'], $c['raridade'], $c['pct'], implode(', ', array_slice($c['holders'], 0, 6)) . (count($c['holders']) > 6 ? '…' : ''));
$p = player_profile(2026, $argv[1] ?? 'Morkan');
printf("\n%s: %dº, %s pts | decks %d | oponentes %d | conquistas %d\n", $p['nome'], $p['ranking']['rk'], $p['ranking']['pts'], count($p['decks']), $p['oponentes'], count($p['conquistas']));
foreach (array_slice($p['h2h'], 0, 4) as $h) printf("  vs %-16s mesas %d: %d V, %d E, %d D, %d outro venceu\n", $h['nome'], $h['n'], $h['v'], $h['e'], $h['d'], $h['x']);
echo '  evolução: ', implode(' ', array_map(fn($e) => $e['etapa'] . ':' . ($e['rk'] ?? '-'), $p['evolucao'])), "\n";
