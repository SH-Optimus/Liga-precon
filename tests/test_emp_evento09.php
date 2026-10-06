<?php
// Recria o Evento 09 (03/10/2026) com as mesas e resultados do EMP e confere a classificação.
putenv('LIGA_DATA_DIR=' . sys_get_temp_dir() . '/liga-test-' . getmypid());
require __DIR__ . '/../public/lib/tournament.php';

$players = ['Erickpd','caiobmbh','Fabio C','Gabriel P.','Campera','Morkan','Bydo','Like a Dragon','Skeeter','Luiz Felipe Barroso',
            'Salmonela','Karyum','Yasmin','TendiNietzsche','Crothen','Henrique','Matheus h'];
q('INSERT INTO events (title, season, etapa, date) VALUES (\'Evento 09\', 2026, 9, \'2026-10-03\')');
$ev = (int)db()->lastInsertId();
$E = [];
foreach ($players as $p) {
    q('INSERT OR IGNORE INTO players (name) VALUES (?)', [$p]);
    $pid = one('SELECT id FROM players WHERE name = ?', [$p])['id'];
    q('INSERT INTO entries (event_id, player_id, deck, checked_in) VALUES (?, ?, \'x\', 1)', [$ev, $pid]);
    $E[$p] = (int)db()->lastInsertId();
}
// [mesa => [jogadores], resultado]  'E' = empate; nome = vencedor
$R = [
 1 => [[['Salmonela','TendiNietzsche','Karyum','Morkan'],'E'], [['Luiz Felipe Barroso','Bydo','caiobmbh','Fabio C'],'E'],
       [['Campera','Like a Dragon','Yasmin','Gabriel P.'],'E'], [['Henrique','Crothen','Erickpd','Matheus h'],'Erickpd'], [['Skeeter'],'B']],
 2 => [[['Erickpd','Morkan','caiobmbh','Campera'],'E'], [['Fabio C','Karyum','Skeeter','Yasmin'],'Fabio C'],
       [['Bydo','Like a Dragon','Salmonela','Luiz Felipe Barroso'],'E'], [['Gabriel P.','Matheus h','Crothen','Henrique'],'Gabriel P.']],
 3 => [[['Fabio C','Erickpd','Gabriel P.','Luiz Felipe Barroso'],'Erickpd'], [['Like a Dragon','Campera','Morkan','Bydo'],'E'],
       [['caiobmbh','Yasmin','Salmonela','Skeeter'],'caiobmbh'], [['Karyum','Crothen','Henrique','Matheus h'],'E']],
];
foreach ($R as $n => $pods) {
    q('INSERT INTO rounds (event_id, number, kind, status) VALUES (?, ?, \'suico\', \'fechada\')', [$ev, $n]);
    $rid = (int)db()->lastInsertId();
    foreach ($pods as $i => [$ps, $res]) {
        $bye = $res === 'B';
        $result = $bye ? 'B' : ($res === 'E' ? 'E' : 'V:' . $E[$res]);
        q('INSERT INTO pods (round_id, table_no, bye, result) VALUES (?, ?, ?, ?)', [$rid, $i + 1, $bye ? 1 : 0, $result]);
        $pid = (int)db()->lastInsertId();
        foreach ($ps as $k => $p) q('INSERT INTO seats (pod_id, entry_id, seat) VALUES (?, ?, ?)', [$pid, $E[$p], $k + 1]);
    }
}
q('UPDATE entries SET dropped = 1 WHERE id = ?', [$E['TendiNietzsche']]);

// Tabela do EMP: rank, jogador, pontos, TB1, TB2, TB3
$EMP = [[1,'Erickpd',7,6,2.67,3.33],[2,'caiobmbh',5,6,3.11,4.22],[3,'Fabio C',4,4,3.38,3.88],[4,'Gabriel P.',4,4,2.56,3.11],
 [5,'Campera',3,6,3.71,5.14],[6,'Morkan',3,6,3.25,4.88],[7,'Bydo',3,6,3.14,5.14],[8,'Like a Dragon',3,6,2.57,4.57],
 [9,'Skeeter',3,0,2.8,3.8],[10,'Luiz Felipe Barroso',2,4,4,5.14],[11,'Salmonela',2,4,2.56,3.89],[12,'Karyum',2,3,1.89,2],
 [13,'Yasmin',1,2,3.25,4.13],[14,'TendiNietzsche',1,2,2.33,4.33],[15,'Crothen',1,0,3,2.6],[15,'Henrique',1,0,3,2.6],[15,'Matheus h',1,0,3,2.6]];

$st = standings($ev);
$fail = 0;
foreach ($EMP as $i => [$rank, $name, $pts, $t1, $t2, $t3]) {
    $s = $st[$i];
    $ok = $s['name'] === $name || ($rank === 15 && $s['rank'] === 15);
    $ok = $ok && $s['rank'] === $rank && $s['pts'] == $pts && $s['tb1'] == $t1 && round($s['tb2'], 2) == $t2 && round($s['tb3'], 2) == $t3;
    printf("%s %2d %-20s pts %d tb1 %g tb2 %.2f tb3 %.2f\n", $ok ? 'ok ' : 'ERR', $s['rank'], $s['name'], $s['pts'], $s['tb1'], $s['tb2'], $s['tb3']);
    if (!$ok) { $fail++; printf("    esperado: %d %s %d %g %g %g\n", $rank, $name, $pts, $t1, $t2, $t3); }
}
echo $fail ? "\nFALHOU: $fail diferença(s)\n" : "\nOK: classificação idêntica à do EMP\n";
exit($fail ? 1 : 0);
