<?php
// Confere a matriz deck × deck do sistema contra a planilha "confrontos decks 2026"
putenv('LIGA_DATA_DIR=' . sys_get_temp_dir() . '/liga-decks-' . getmypid());
require __DIR__ . '/../public/lib/decks.php';
$o = decks_overview(2026);
$net = []; foreach ($o['cells'] as $a => $r) foreach ($r as $b => $c) $net["$a|$b"] = $c[0];
echo json_encode($net, JSON_UNESCAPED_UNICODE);
$p = deck_page(2026, 'quick draw');
fwrite(STDERR, sprintf("%s: %d partidas, %s%% | pilotos %d | confrontos %d | favoráveis: %s | desfavoráveis: %s\n", $p['nome'], $p['stats']['p'], $p['stats']['wr'],
  count($p['pilotos']), count($p['confrontos']), implode(', ', array_map(fn($x) => $x['deck'] . ' ' . sprintf('%+d', $x['saldo']), $p['favoraveis'])),
  implode(', ', array_map(fn($x) => $x['deck'] . ' ' . sprintf('%+d', $x['saldo']), $p['desfavoraveis']))));
