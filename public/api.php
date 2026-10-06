<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/tournament.php';
require_once __DIR__ . '/lib/season.php';
require_once __DIR__ . '/lib/profile.php';
require_once __DIR__ . '/lib/decks.php';
require_once __DIR__ . '/lib/finals.php';
require_once __DIR__ . '/lib/export.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_name('liga_sess');
session_start();

function out($data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }
function body(): array {
    static $b = null;
    if ($b === null) $b = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
    return $b;
}
function arg(string $k, $def = null) { return body()[$k] ?? $_GET[$k] ?? $def; }
function int_arg(string $k): int {
    $v = arg($k);
    if (!is_numeric($v)) fail("Parâmetro '$k' inválido.");
    return (int)$v;
}
function str_arg(string $k, int $max = 80, bool $required = true): string {
    $v = trim((string)arg($k, ''));
    $v = preg_replace('/\s+/u', ' ', $v);
    if ($required && $v === '') fail("Preencha o campo '$k'.");
    if (mb_strlen($v) > $max) fail("Campo '$k' muito longo.");
    return $v;
}
function is_admin(): bool { return !empty($_SESSION['admin']); }
function need_admin(): void { if (!is_admin()) fail('Faça login como organizador.', 401); }

// Limite de tentativas (PIN e login): 10 erros a cada 15 minutos por IP
function throttle(string $kind): void {
    $k = $kind . ':' . ($_SERVER['REMOTE_ADDR'] ?? '?');
    $r = one('SELECT * FROM attempts WHERE k = ?', [$k]);
    if ($r && time() - $r['since'] < 900 && $r['n'] >= 10) fail('Muitas tentativas. Espere 15 minutos.', 429);
}
function bad_attempt(string $kind): void {
    $k = $kind . ':' . ($_SERVER['REMOTE_ADDR'] ?? '?');
    $r = one('SELECT * FROM attempts WHERE k = ?', [$k]);
    if (!$r || time() - $r['since'] >= 900) q('INSERT OR REPLACE INTO attempts (k, n, since) VALUES (?, 1, ?)', [$k, time()]);
    else q('UPDATE attempts SET n = n + 1 WHERE k = ?', [$k]);
}

function check_pin(array $player, string $pin): void {
    throttle('pin');
    if (!$player['pin_hash']) fail('Você ainda não tem PIN. Defina um ao se inscrever pelo site, ou peça à organização para lançar o resultado.', 403);
    if (!password_verify($pin, $player['pin_hash'])) { bad_attempt('pin'); fail('PIN incorreto.', 403); }
}
function valid_pin(string $pin): void {
    if (!preg_match('/^\d{4,6}$/', $pin)) fail('O PIN precisa ter de 4 a 6 números.');
}

function event_public(int $id): array {
    $ev = one('SELECT * FROM events WHERE id = ?', [$id]);
    if (!$ev) fail('Evento não encontrado.', 404);
    $rounds = event_rounds($id);
    $st = standings($id, $rounds);
    $reports = [];
    foreach (all('SELECT r.pod_id, r.entry_id, r.outcome, r.created_at FROM reports r
                  JOIN pods p ON p.id = r.pod_id JOIN rounds ro ON ro.id = p.round_id WHERE ro.event_id = ?', [$id]) as $r)
        $reports[$r['pod_id']][] = $r;
    foreach ($rounds as &$r) foreach ($r['pods'] as &$p) $p['reports'] = $reports[$p['id']] ?? [];
    unset($r, $p);
    $entries = array_map(fn($s) => ['id' => $s['id'], 'name' => $s['name'], 'deck' => $s['deck'], 'dropped' => (int)$s['dropped'],
        'checked_in' => (int)$s['checked_in'], 'paid' => (int)$s['paid'], 'approved' => (int)$s['approved'], 'dq' => (int)$s['dq']], $st);
    // Na pré-inscrição, só a organização vê quem ainda não foi aprovado
    if (!is_admin()) { $entries = array_values(array_filter($entries, fn($e) => $e['approved']));
                       foreach ($entries as &$e) unset($e['paid']); unset($e); }
    usort($entries, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    if (!is_admin()) $st = array_values(array_filter($st, fn($s) => $s['approved']));
    $stand = array_map(fn($s) => ['id' => $s['id'], 'rank' => $s['rank'], 'name' => $s['name'], 'deck' => $s['deck'], 'pts' => $s['pts'],
        'v' => $s['v'], 'e' => $s['e'], 'd' => $s['d'], 'byes' => $s['byes'], 'tb1' => $s['tb1'], 'tb2' => round($s['tb2'], 2),
        'tb3' => round($s['tb3'], 2), 'dropped' => (int)$s['dropped'], 'dq' => (int)$s['dq'], 'played' => count($s['seq'])], $st);
    $absolute = null;
    $swissDone = count(array_filter($rounds, fn($r) => $r['kind'] === 'suico' && $r['status'] === 'fechada')) >= (int)$ev['rounds'];
    if ($swissDone && ($w = absolute_winner($st, (int)$ev['rounds']))) $absolute = $w['name'];
    return ['event' => $ev, 'rounds' => $rounds, 'entries' => $entries, 'standings' => $stand,
            'absolute_winner' => $absolute, 'now' => gmdate('Y-m-d H:i:s'),
            'rules' => ['round_minutes' => (int)$ev['round_minutes'], 'swiss_rounds' => (int)$ev['rounds'], 'final_table' => (int)$ev['final_table']],
            'banned' => banned_decks((int)$ev['season'])];
}

$a = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
// Escritas só via POST com cabeçalho próprio (impede formulários de outros sites)
if ($method === 'POST' && ($_SERVER['HTTP_X_LIGA'] ?? '') !== '1') fail('Requisição inválida.', 400);

try {
    switch ($a) {
    /* ---------------- público ---------------- */
    case 'events':
        out(['events' => all("SELECT e.*, (SELECT COUNT(*) FROM entries WHERE event_id = e.id AND approved = 1) AS n
                              FROM events e " . (is_admin() ? '' : 'WHERE e.public = 1 ') . "ORDER BY CASE status WHEN 'andamento' THEN 0 WHEN 'inscricoes' THEN 1 ELSE 2 END, date DESC, id DESC"),
             'admin' => is_admin()]);

    case 'event':
        out(event_public(int_arg('id')) + ['admin' => is_admin()]);

    case 'season':
        out(season_data((int)arg('season', SEASON)));

    case 'player':
        $prof = player_profile((int)arg('season', SEASON), str_arg('name', 60));
        if (!$prof) fail('Jogador não encontrado.', 404);
        out($prof);

    case 'decks_overview':
        out(decks_overview((int)arg('season', SEASON)));

    case 'deck':
        $dp = deck_page((int)arg('season', SEASON), str_arg('name', 80));
        if (!$dp) fail('Deck não encontrado.', 404);
        out($dp);

    case 'achievements':
        out(achievements_overview((int)arg('season', SEASON)));

    case 'decks':
        $known = array_column(all('SELECT DISTINCT deck FROM history UNION SELECT DISTINCT deck FROM entries WHERE deck <> \'\' ORDER BY 1'), 'deck');
        out(['decks' => $known, 'banned' => banned_decks((int)arg('season', SEASON))]);

    case 'players':
        out(['players' => array_column(all('SELECT name FROM players ORDER BY name COLLATE NOCASE'), 'name')]);

    case 'register':
        if ($method !== 'POST') fail('Use POST.', 405);
        $ev = one('SELECT * FROM events WHERE id = ?', [int_arg('event_id')]);
        if (!$ev) fail('Evento não encontrado.', 404);
        if ($ev['status'] === 'encerrado' || !$ev['reg_open']) fail('As inscrições deste evento estão fechadas. Fale com a organização.');
        $name = str_arg('name', 40); $deck = str_arg('deck', 60); $pin = (string)arg('pin', '');
        valid_pin($pin);
        if (in_array(mb_strtolower($deck), array_map('mb_strtolower', banned_decks((int)$ev['season'])), true)) fail("O deck $deck está banido por performance nesta temporada.");
        $pl = one('SELECT * FROM players WHERE name = ?', [$name]);
        if ($pl && $pl['pin_hash']) check_pin($pl, $pin);
        elseif ($pl) q('UPDATE players SET pin_hash = ? WHERE id = ?', [password_hash($pin, PASSWORD_DEFAULT), $pl['id']]);
        else { q('INSERT INTO players (name, pin_hash) VALUES (?, ?)', [$name, password_hash($pin, PASSWORD_DEFAULT)]); $pl = one('SELECT * FROM players WHERE name = ?', [$name]); }
        $en = one('SELECT * FROM entries WHERE event_id = ? AND player_id = ?', [$ev['id'], $pl['id']]);
        if ($en) { q('UPDATE entries SET deck = ? WHERE id = ?', [$deck, $en['id']]); out(['ok' => true, 'msg' => 'Inscrição atualizada.']); }
        q('INSERT INTO entries (event_id, player_id, deck, approved) VALUES (?, ?, ?, ?)', [$ev['id'], $pl['id'], $deck, $ev['pre_reg'] ? 0 : 1]);
        out(['ok' => true, 'msg' => $ev['pre_reg'] ? 'Pré-inscrição enviada! A organização vai aprovar e confirmar o pagamento.'
                                                   : 'Inscrição feita! Confirme o pagamento com a organização.']);

    case 'report':
        if ($method !== 'POST') fail('Use POST.', 405);
        $en = one('SELECT en.*, pl.pin_hash, pl.name FROM entries en JOIN players pl ON pl.id = en.player_id WHERE en.id = ?', [int_arg('entry_id')]);
        if (!$en) fail('Inscrição não encontrada.', 404);
        check_pin($en, (string)arg('pin', ''));
        $st = player_report(int_arg('pod_id'), (int)$en['id'], (string)arg('outcome', ''));
        out(['ok' => true, 'status' => $st, 'msg' => ['confirmado' => 'Resultado confirmado!', 'pendente' => 'Resultado enviado. Falta outro jogador da mesa confirmar (ou a organização).',
             'divergente' => 'Resultado enviado, mas outro jogador reportou diferente. A organização vai resolver.'][$st]]);

    case 'drop':
        if ($method !== 'POST') fail('Use POST.', 405);
        $en = one('SELECT en.*, pl.pin_hash FROM entries en JOIN players pl ON pl.id = en.player_id WHERE en.id = ?', [int_arg('entry_id')]);
        if (!$en) fail('Inscrição não encontrada.', 404);
        check_pin($en, (string)arg('pin', ''));
        q('UPDATE entries SET dropped = 1 WHERE id = ?', [$en['id']]);
        out(['ok' => true, 'msg' => 'Você saiu do evento. Boa volta pra casa!']);

    /* ---------------- organização ---------------- */
    case 'me':
        out(['admin' => is_admin(), 'user' => $_SESSION['admin'] ?? null, 'needs_setup' => !one('SELECT 1 FROM admins')]);

    case 'setup':
        if ($method !== 'POST') fail('Use POST.', 405);
        if (one('SELECT 1 FROM admins')) fail('O sistema já foi configurado.');
        throttle('login');
        $tok = getenv('LIGA_SETUP_TOKEN') ?: SETUP_TOKEN;
        if (!hash_equals($tok, (string)arg('token', '')) || $tok === '__SETUP_TOKEN__') { bad_attempt('login'); fail('Token de configuração incorreto.', 403); }
        $user = str_arg('user', 40); $pass = (string)arg('pass', '');
        if (mb_strlen($pass) < 8) fail('A senha precisa ter pelo menos 8 caracteres.');
        q('INSERT INTO admins (user, pass_hash) VALUES (?, ?)', [$user, password_hash($pass, PASSWORD_DEFAULT)]);
        session_regenerate_id(true); $_SESSION['admin'] = $user;
        out(['ok' => true]);

    case 'login':
        if ($method !== 'POST') fail('Use POST.', 405);
        throttle('login');
        $ad = one('SELECT * FROM admins WHERE user = ?', [str_arg('user', 40)]);
        if (!$ad || !password_verify((string)arg('pass', ''), $ad['pass_hash'])) { bad_attempt('login'); fail('Usuário ou senha incorretos.', 403); }
        session_regenerate_id(true); $_SESSION['admin'] = $ad['user'];
        out(['ok' => true]);

    case 'logout':
        $_SESSION = []; session_destroy();
        out(['ok' => true]);

    case 'admin_add':
        need_admin();
        $user = str_arg('user', 40); $pass = (string)arg('pass', '');
        if (mb_strlen($pass) < 8) fail('A senha precisa ter pelo menos 8 caracteres.');
        q('INSERT INTO admins (user, pass_hash) VALUES (?, ?) ON CONFLICT(user) DO UPDATE SET pass_hash = excluded.pass_hash', [$user, password_hash($pass, PASSWORD_DEFAULT)]);
        out(['ok' => true, 'msg' => "Organizador $user salvo."]);

    case 'event_save':
        need_admin();
        $etapa = arg('etapa'); $etapa = ($etapa === '' || $etapa === null) ? null : (int)$etapa;
        $date = (string)arg('date', '');
        if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail('Data inválida.');
        $title = str_arg('title', 80); $season = (int)arg('season', SEASON);
        $time = (string)arg('start_time', '');
        if ($time !== '' && !preg_match('/^\d{2}:\d{2}$/', $time)) fail('Hora inválida.');
        $rounds = (int)arg('rounds', SWISS_ROUNDS); $mins = (int)arg('round_minutes', ROUND_MINUTES);
        if ($rounds < 1 || $rounds > 10) fail('Número de rodadas inválido (1 a 10).');
        if ($mins < 10 || $mins > 300) fail('Tempo de rodada inválido (10 a 300 minutos).');
        $flags = [];
        foreach (['final_table' => 1, 'pre_reg' => 0, 'public' => 1, 'test' => 0, 'no_bye' => 0, 'all_byes_score' => 1, 'allow_edit' => 1, 'bye_by_ranking' => 1] as $k => $def)
            $flags[$k] = (int)(bool)arg($k, $def);
        $f = ['title' => $title, 'etapa' => $etapa, 'date' => $date ?: null, 'start_time' => $time ?: null, 'season' => $season,
              'description' => str_arg('description', 2000, false), 'rounds' => $rounds, 'round_minutes' => $mins] + $flags;
        $id = (int)arg('id', 0);
        if ($id) {
            $cur = one('SELECT * FROM events WHERE id = ?', [$id]);
            if (!$cur) fail('Evento não encontrado.', 404);
            if ($cur['status'] !== 'inscricoes' && (int)$cur['rounds'] !== $rounds && one('SELECT 1 FROM rounds WHERE event_id = ? AND number > ?', [$id, $rounds]))
                fail('Já existem mais rodadas do que esse número.');
            q('UPDATE events SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($f))) . ' WHERE id = ?', [...array_values($f), $id]);
        } else {
            q('INSERT INTO events (' . implode(', ', array_keys($f)) . ') VALUES (' . implode(', ', array_fill(0, count($f), '?')) . ')', array_values($f));
            $id = (int)db()->lastInsertId();
        }
        out(['ok' => true, 'id' => $id]);

    case 'event_delete':
        need_admin();
        $ev = one('SELECT * FROM events WHERE id = ?', [int_arg('id')]);
        if (!$ev) fail('Evento não encontrado.', 404);
        if ($ev['status'] === 'encerrado') fail('Reabra o evento antes de excluir.');
        q('DELETE FROM events WHERE id = ?', [$ev['id']]);
        out(['ok' => true]);

    case 'entry_add':
        need_admin();
        $eid = int_arg('event_id'); $name = str_arg('name', 40); $deck = str_arg('deck', 60, false);
        q('INSERT OR IGNORE INTO players (name) VALUES (?)', [$name]);
        $pl = one('SELECT * FROM players WHERE name = ?', [$name]);
        if (one('SELECT 1 FROM entries WHERE event_id = ? AND player_id = ?', [$eid, $pl['id']])) fail("{$pl['name']} já está inscrito.");
        q('INSERT INTO entries (event_id, player_id, deck, checked_in) VALUES (?, ?, ?, ?)', [$eid, $pl['id'], $deck, (int)arg('checked_in', 0)]);
        out(['ok' => true]);

    case 'entry_update':
        need_admin();
        $en = one('SELECT * FROM entries WHERE id = ?', [int_arg('id')]);
        if (!$en) fail('Inscrição não encontrada.', 404);
        $f = [];
        foreach (['paid', 'checked_in', 'dropped', 'approved', 'dq'] as $k) if (arg($k) !== null) $f[$k] = (int)(bool)arg($k);
        if (arg('deck') !== null) $f['deck'] = str_arg('deck', 60, false);
        foreach ($f as $k => $v) q("UPDATE entries SET $k = ? WHERE id = ?", [$v, $en['id']]);
        out(['ok' => true]);

    case 'entry_delete':
        need_admin();
        $en = one('SELECT * FROM entries WHERE id = ?', [int_arg('id')]);
        if (!$en) fail('Inscrição não encontrada.', 404);
        if (one('SELECT 1 FROM seats WHERE entry_id = ?', [$en['id']])) fail('Este jogador já jogou rodadas. Use “drop” em vez de excluir.');
        q('DELETE FROM entries WHERE id = ?', [$en['id']]);
        out(['ok' => true]);

    case 'reg_toggle':
        need_admin();
        q('UPDATE events SET reg_open = ? WHERE id = ?', [(int)(bool)arg('open', 0), int_arg('id')]);
        out(['ok' => true]);

    case 'checkin_all':
        need_admin();
        q('UPDATE entries SET checked_in = 1 WHERE event_id = ? AND dropped = 0 AND approved = 1', [int_arg('event_id')]);
        out(['ok' => true]);

    case 'pin_reset':
        need_admin();
        q('UPDATE players SET pin_hash = NULL WHERE name = ?', [str_arg('name', 40)]);
        out(['ok' => true, 'msg' => 'PIN apagado. O jogador define um novo na próxima inscrição.']);

    case 'reload_seed':
        need_admin();
        $r = reload_seed();
        out(['ok' => true, 'msg' => "Histórico da planilha recarregado: {$r['historico']} resultados e {$r['mesas']} participações em mesas. "
            . ($r['etapas_do_sistema_preservadas'] ? "{$r['etapas_do_sistema_preservadas']} etapa(s) fechada(s) pelo sistema foram mantidas." : '')]);

    case 'round_generate':
        need_admin();
        $rid = generate_swiss_round(int_arg('event_id'));
        out(['ok' => true, 'round_id' => $rid]);

    case 'final_generate':
        need_admin();
        $ids = arg('entry_ids'); $ids = is_array($ids) && $ids ? $ids : null;
        out(['ok' => true, 'round_id' => generate_final(int_arg('event_id'), $ids)]);

    case 'export':
        need_admin();
        $season = (int)arg('season', SEASON);
        match ((string)arg('t', '')) {
            'registro' => export_registro($season),
            'mesas' => export_mesas($season),
            'ranking' => export_ranking($season),
            'decks' => export_decks($season),
            'confrontos' => export_confrontos($season),
            'evento' => export_event(int_arg('id')),
            'banco' => send_db_backup(),
            default => fail('Tipo de exportação desconhecido.'),
        };
        exit;

    case 'publish_swiss':
        need_admin();
        $r = publish_swiss(int_arg('event_id'));
        out(['ok' => true, 'msg' => "Suíço publicado no ranking com {$r['jogadores']} jogadores (final pendente). Depois da final, feche o evento para completar a etapa."]);

    case 'imported_finals':
        need_admin();
        out(['etapas' => imported_finals((int)arg('season', SEASON))]);

    case 'imported_final':
        need_admin();
        $fin = arg('finalists'); if (!is_array($fin)) fail('Escolha os finalistas.');
        $r = finalize_imported((int)arg('season', SEASON), int_arg('etapa'), $fin, (string)arg('outcome', ''));
        out(['ok' => true, 'msg' => 'Final lançada. Campeão: ' . $r['campeao'] . ($r['empate'] ? ' (final empatada: melhor colocado no suíço)' : '') . '. Ranking atualizado.']);

    case 'imported_final_undo':
        need_admin();
        undo_imported_final((int)arg('season', SEASON), int_arg('etapa'));
        out(['ok' => true, 'msg' => 'Final desfeita: a etapa voltou a ficar com a final pendente.']);

    case 'swap':
        need_admin(); swap_seats(int_arg('a'), int_arg('b'), int_arg('round_id')); out(['ok' => true]);

    case 'round_close':
        need_admin(); close_round(int_arg('round_id')); out(['ok' => true]);

    case 'round_reopen':
        need_admin();
        $r = one('SELECT * FROM rounds WHERE id = ?', [int_arg('round_id')]);
        $last = one('SELECT MAX(number) m FROM rounds WHERE event_id = ?', [$r['event_id'] ?? 0]);
        if (!$r || (int)$last['m'] !== (int)$r['number']) fail('Só é possível reabrir a última rodada.');
        if (one('SELECT 1 FROM events WHERE id = ? AND status = \'encerrado\'', [$r['event_id']])) fail('Reabra o evento antes.');
        q('UPDATE rounds SET status = \'aberta\', closed_at = NULL WHERE id = ?', [$r['id']]);
        out(['ok' => true]);

    case 'round_delete':
        need_admin(); delete_round(int_arg('round_id')); out(['ok' => true]);

    case 'pod_result':
        need_admin();
        $o = arg('outcome'); $o = ($o === '' || $o === null) ? null : (string)$o;
        set_pod_result(int_arg('pod_id'), $o);
        out(['ok' => true]);

    case 'close_preview':
        need_admin();
        out(final_placement(int_arg('event_id')));

    case 'event_close':
        need_admin();
        out(['ok' => true] + close_event(int_arg('event_id')));

    case 'event_reopen':
        need_admin(); reopen_event(int_arg('event_id')); out(['ok' => true]);

    default:
        fail('Ação desconhecida.', 404);
    }
} catch (UserError $e) {
    fail($e->getMessage());
} catch (Throwable $e) {
    error_log('[liga] ' . $e);
    fail('Erro interno. Tente de novo; se continuar, avise a organização.', 500);
}
