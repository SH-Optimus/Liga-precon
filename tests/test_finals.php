<?php
// Final em outro dia: etapa importada (Etapa 09) e evento do sistema com suíço publicado antes da final.
putenv('LIGA_DATA_DIR=' . sys_get_temp_dir() . '/liga-finals-' . getmypid());
require __DIR__ . '/../public/lib/finals.php';
$fail = 0;
$ok = function (bool $c, string $msg) use (&$fail) { echo ($c ? 'ok  ' : 'ERR ') . $msg . "\n"; if (!$c) $fail++; };
$snap = fn($e) => all('SELECT player, pos, ap, v, e, d, source FROM history WHERE season = 2026 AND etapa = ? ORDER BY player', [$e]);
$rank = fn() => array_column(season_data(2026)['pl'], 'pts', 'n');

// ---- 1. Etapa 09 importada
$pend = array_values(array_filter(imported_finals(2026), fn($e) => $e['pendente']));
$ok(count($pend) === 1 && $pend[0]['etapa'] === 9, 'Etapa 09 aparece como final pendente');
$antes = $snap(9); $rankAntes = $rank(); $gAntes = one('SELECT COUNT(*) n FROM hist_games WHERE etapa = 9')['n'];
$r = finalize_imported(2026, 9, ['Erickpd', 'caiobmbh', 'Fabio C', 'Gabriel P.'], 'caiobmbh');
$h = array_column(all('SELECT * FROM history WHERE etapa = 9 ORDER BY pos'), null, 'player');
$ok($r['campeao'] === 'caiobmbh' && (int)$h['caiobmbh']['pos'] === 1 && (int)$h['caiobmbh']['ap'] === 3, 'campeão caiobmbh: 1º com 3 pontos de liga');
$ok((int)$h['Erickpd']['pos'] === 2 && (int)$h['Fabio C']['pos'] === 3 && (int)$h['Gabriel P.']['pos'] === 4, 'demais finalistas em 2º a 4º, na ordem do suíço');
$ok((int)$h['Campera']['pos'] === 5 && (int)$h['Campera']['ap'] === 2 && (int)$h['Skeeter']['ap'] === 1, '5º ao 8º com 2 pontos, 9º em diante com 1');
$ok($h['caiobmbh']['v'] == 2 && $h['Erickpd']['d'] == 1, 'V-E-D inclui a mesa final (caiobmbh 2 vitórias, Erickpd +1 derrota)');
$ok(one("SELECT COUNT(*) n FROM hist_games WHERE etapa = 9 AND kind = 'final'")['n'] == 4, '4 linhas da mesa final no histórico de mesas');
$rk = $rank(); $ok($rk['caiobmbh'] == $rankAntes['caiobmbh'] + 3 && $rk['Morkan'] == $rankAntes['Morkan'] + 2, 'ranking anual somou os pontos da etapa');
reload_seed();
$ok((int)one("SELECT pos FROM history WHERE etapa = 9 AND player = 'caiobmbh'")['pos'] === 1, 'recarregar a planilha não apaga a final lançada');
$ok(one('SELECT COUNT(*) n FROM hist_games WHERE etapa = 9')['n'] == $gAntes + 4, 'mesas da etapa preservadas após recarregar');
// relançar com outro vencedor (correção) não duplica a final
finalize_imported(2026, 9, ['Erickpd', 'caiobmbh', 'Fabio C', 'Gabriel P.'], 'Erickpd');
$h = array_column(all('SELECT * FROM history WHERE etapa = 9'), null, 'player');
$ok((int)$h['Erickpd']['pos'] === 1 && $h['Erickpd']['v'] == 3 && $h['caiobmbh']['v'] == 1 && $h['caiobmbh']['d'] == 1, 'corrigir o vencedor refaz V-E-D sem duplicar');
undo_imported_final(2026, 9);
$ok($snap(9) == $antes && $rank() == $rankAntes, 'desfazer volta a etapa exatamente ao estado da planilha');

// ---- 2. Evento do sistema com final em outro dia
q("INSERT INTO events (title, season, etapa, date) VALUES ('Etapa 10 teste', 2026, 10, '2026-10-31')");
$ev = (int)db()->lastInsertId();
$names = ['Morkan','Fabio C','Crothen','Yasmin','Erickpd','Campera','Lanna','Bydo','Gabriel P.','caiobmbh','Karyum','Henrique'];
foreach ($names as $n) q('INSERT INTO entries (event_id, player_id, deck, checked_in) VALUES (?, (SELECT id FROM players WHERE name = ?), \'Quick Draw\', 1)', [$ev, $n]);
mt_srand(3);
for ($i = 0; $i < 3; $i++) {
    $rid = generate_swiss_round($ev, 10 + $i);
    foreach (all('SELECT * FROM pods WHERE round_id = ? AND bye = 0', [$rid]) as $p) {
        $s = all('SELECT entry_id FROM seats WHERE pod_id = ? ORDER BY seat', [$p['id']]);
        set_pod_result((int)$p['id'], $i === 1 ? 'E' : 'V:' . $s[0]['entry_id']);
    }
    close_round($rid);
}
$r = publish_swiss($ev);
$ok($r['jogadores'] === 12 && one('SELECT COUNT(*) n FROM history WHERE etapa = 10 AND ap IS NULL')['n'] == 12, 'suíço publicado: 12 jogadores com final pendente');
$st = array_values(array_filter(standings($ev), fn($s) => count($s['seq'])));
$top = array_column(array_slice($st, 0, 5), 'id');
$chosen = [$top[0], $top[1], $top[2], $top[4]];   // o 4º não pôde ficar: entra o 5º
generate_final($ev, $chosen);
$fr = one("SELECT r.id rid, p.id pid FROM rounds r JOIN pods p ON p.round_id = r.id WHERE r.event_id = ? AND r.kind = 'final'", [$ev]);
$seated = array_column(all('SELECT entry_id FROM seats WHERE pod_id = ?', [$fr['pid']]), 'entry_id');
sort($seated); $c2 = $chosen; sort($c2);
$ok($seated == $c2, 'mesa final com os finalistas escolhidos (5º no lugar do 4º)');
set_pod_result((int)$fr['pid'], 'V:' . $top[4]); close_round((int)$fr['rid']);
close_event($ev);
$h = array_column(all('SELECT * FROM history WHERE etapa = 10 ORDER BY pos'), null, 'pos');
$champ = one('SELECT pl.name FROM entries en JOIN players pl ON pl.id = en.player_id WHERE en.id = ?', [$top[4]])['name'];
$ok($h[1]['player'] === $champ && (int)$h[1]['ap'] === 3 && one('SELECT COUNT(*) n FROM history WHERE etapa = 10 AND ap IS NULL')['n'] == 0, "evento fechado: $champ campeão e todos com pontos de liga");
echo $fail ? "\nFALHOU: $fail\n" : "\nOK: todos os testes de final passaram\n";
exit($fail ? 1 : 0);
