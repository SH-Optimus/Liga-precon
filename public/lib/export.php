<?php
require_once __DIR__ . '/decks.php';

/* ============================================================
   Exportação (CSV no formato das planilhas da organização) e backup do banco
   CSV com ";" e vírgula decimal (padrão do Excel/Planilhas em português) e BOM UTF-8.
   ============================================================ */

const MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function br_num($v, int $dec = 2): string { return number_format((float)$v, $dec, ',', ''); }

function send_csv(string $name, array $header, array $rows): never {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header('Cache-Control: no-store');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, $header, ';', '"', '');
    foreach ($rows as $r) fputcsv($out, $r, ';', '"', '');
    fclose($out);
    exit;
}

function month_of(?string $date): int { return $date ? (int)substr($date, 5, 2) : 0; }

// tab_registrojogos: uma linha por jogador em cada etapa
function export_registro(int $season): void {
    $rows = [];
    foreach (all('SELECT * FROM history WHERE season = ? ORDER BY etapa, pos', [$season]) as $r) {
        $m = MESES[month_of($r['date'])] ?? '';
        // Desempate TB = vitórias/10 + TB1/100 + TB2/1000 + TB3/1000000 (como na planilha: Erickpd E01 = 0,26275363)
        $tb = $r['v'] / 10 + $r['tb1'] / 100 + $r['tb2'] / 1000 + $r['tb3'] / 1000000;
        $rows[] = [$m . '_' . $r['player'], $season, sprintf('%02d', $r['etapa']), $r['pos'], $r['player'], $r['deck'],
                   br_num($r['pts'], 0), br_num($r['tb1'], 0), br_num($r['tb2']), br_num($r['tb3']), br_num($tb, 8),
                   $r['v'], $r['e'], $r['d'], $r['ap'] ?? '', $r['ap'] === null ? '' : br_num($r['ap'] + $tb, 6)];
    }
    send_csv("liga-$season-registro-jogos.csv",
        ['Chave Mes Jogador', 'Liga Ano', 'Etapa Liga', 'Colocação EMP', 'Jogador', 'Deck', 'EMP Pontos', 'EMP TB1', 'EMP TB2', 'EMP TB3',
         'Desempate TB', 'Vitórias', 'Empates', 'Derrotas', 'De/Para Pontuação Anual', 'Pontuação Anual Final'], $rows);
}

// resultados liga precon: uma linha por jogador em cada mesa
function export_mesas(int $season): void {
    $G = all('SELECT g.*, h.date FROM hist_games g LEFT JOIN (SELECT DISTINCT season, etapa, date FROM history) h ON h.season = g.season AND h.etapa = g.etapa
              WHERE g.season = ? ORDER BY g.etapa, g.round, CASE WHEN g.pod = \'bye\' THEN 999 ELSE CAST(g.pod AS INTEGER) END, g.id', [$season]);
    $decks = [];
    foreach ($G as $g) if ($g['pod'] !== 'bye') $decks[$g['etapa'] . '|' . $g['round'] . '|' . $g['pod']][] = $g['deck'];
    $rows = [];
    foreach ($G as $g) {
        $mi = month_of($g['date']); $m = MESES[$mi] ?? '';
        $pod = $g['pod'] === 'bye' ? 'Bye' : $g['pod'];
        $pts = ['V' => 3, 'E' => 1, 'D' => 0, 'B' => 3][$g['result']] ?? 0;
        $mesa = $g['pod'] === 'bye' ? '' : '|' . implode('|', $decks[$g['etapa'] . '|' . $g['round'] . '|' . $g['pod']]) . '|';
        $rows[] = [$season, $g['etapa'], $g['round'], $pod, $g['player'], $g['deck'], $g['result'], $pts, $g['player'] . '_' . $g['deck'],
                   "E{$g['etapa']}_R{$g['round']}_M" . ($g['pod'] === 'bye' ? 'Bye' : $g['pod']), $m, $m . '_' . $g['player'],
                   $mi ? sprintf('%02d - %s', $mi, $m) : '', $mesa];
    }
    send_csv("liga-$season-mesas.csv",
        ['Liga Ano', 'Etapa Liga', 'Rodada', 'Mesa', 'Jogador', 'Nome Deck', 'Tipo Resultado', 'Resultado Pontos', 'Chave Jogador Deck',
         'Chave Liga Etapa Rodada', 'Mês Evento', 'Chave Mês Jogador', 'mes_format', 'Decks na Mesa'], $rows);
}

function export_ranking(int $season): void {
    $rows = array_map(fn($p) => [$p['rk'] . 'º', $p['n'], $p['tot'], br_num($p['pts']), br_num($p['tb1']), br_num($p['tb2']), br_num($p['tb3']),
                                 $p['v'], $p['e'], $p['d'], br_num($p['wr']) . '%'], season_data($season)['pl']);
    send_csv("liga-$season-ranking-anual.csv",
        ['Ranking', 'Jogador', 'Pontuação Total Final', 'Pontuação Eventos', 'TB1 Médio', 'TB2 Médio', 'TB3 Médio', 'Vitórias', 'Empates', 'Derrotas', '% Win Rate'], $rows);
}

function export_decks(int $season): void {
    $rows = array_map(fn($d) => [$d['n'], $d['p'], $d['pts'], $d['v'], $d['e'], $d['d'], br_num($d['wr']) . '%', $d['risk'], $d['pil']], season_data($season)['dk']);
    send_csv("liga-$season-ranking-decks.csv",
        ['Nome Deck', 'Partidas Jogadas', 'Pontos Alcançados', 'Vitórias', 'Empates', 'Derrotas', '% Win Rate', 'Risco de Banimento', 'Pilotos'], $rows);
}

// Matriz de confrontos: saldo de vitórias do deck da linha sobre o da coluna (inclui a mesa final)
function export_confrontos(int $season): void {
    $M = deck_matchups($season)['M'];
    $decks = array_column(season_data($season)['dk'], 'n');
    sort($decks, SORT_NATURAL | SORT_FLAG_CASE);
    $rows = [];
    foreach ($decks as $a) {
        $line = []; $sum = 0;
        foreach ($decks as $b) {
            if ($a === $b) { $line[] = ''; continue; }
            $c = $M[$a][$b] ?? null; $v = $c ? $c['w'] - $c['l'] : 0;
            $line[] = $v; $sum += $v;
        }
        $rows[] = array_merge([$a, $sum], $line);
    }
    send_csv("liga-$season-confrontos-decks.csv",
        array_merge(['Nº Vitórias do Deck da Linha sobre o Deck da Coluna', 'Soma Resultados'], $decks), $rows);
}

// Um evento: classificação e todas as mesas
function export_event(int $eventId): void {
    $ev = one('SELECT * FROM events WHERE id = ?', [$eventId]);
    if (!$ev) throw new UserError('Evento não encontrado.');
    $rounds = event_rounds($eventId);
    $st = standings($eventId, $rounds);
    $where = [];
    foreach ($rounds as $r) foreach ($r['pods'] as $p) foreach ($p['seats'] as $s)
        $where[$s['entry_id']][] = ($r['kind'] === 'final' ? 'Final' : 'R' . $r['number']) . ': ' . ($p['bye'] ? 'bye' : 'mesa ' . $p['table_no'] . ' ' . (seat_result($p, (int)$s['entry_id']) ?? '—'));
    $rows = array_map(fn($s) => [$s['rank'], $s['name'], $s['deck'], $s['pts'], $s['v'], $s['e'], $s['d'], $s['byes'],
        br_num($s['tb1'], 0), br_num($s['tb2']), br_num($s['tb3']), $s['dq'] ? 'desclassificado' : ($s['dropped'] ? 'drop' : ''),
        implode(' | ', $where[$s['id']] ?? [])], $st);
    send_csv('evento-' . $eventId . ($ev['etapa'] ? sprintf('-etapa-%02d', $ev['etapa']) : '') . '-resultado.csv',
        ['#', 'Jogador', 'Deck', 'Pontos', 'Vitórias', 'Empates', 'Derrotas', 'Byes', 'TB1', 'TB2', 'TB3', 'Situação', 'Rodadas'], $rows);
}

// Cópia consistente do banco inteiro (VACUUM INTO), para guardar ou restaurar
function send_db_backup(): never {
    $dir = getenv('LIGA_DATA_DIR') ?: DATA_DIR;
    $tmp = $dir . '/backup-' . bin2hex(random_bytes(6)) . '.sqlite';
    db()->exec('VACUUM INTO ' . db()->quote($tmp));
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="liga-precon-backup-' . date('Y-m-d-His') . '.sqlite"');
    header('Content-Length: ' . filesize($tmp));
    header('Cache-Control: no-store');
    readfile($tmp);
    @unlink($tmp);
    exit;
}
