<?php
require_once __DIR__ . '/config.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dir = getenv('LIGA_DATA_DIR') ?: DATA_DIR;
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        throw new RuntimeException('Não foi possível criar a pasta de dados: ' . $dir);
    }
    $file = $dir . '/liga.sqlite';
    $new = !file_exists($file);
    $pdo = new PDO('sqlite:' . $file, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    migrate($pdo);
    if ($new) seed_history($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void {
    $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pin_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  user TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  season INTEGER NOT NULL,
  etapa INTEGER,
  date TEXT,
  start_time TEXT,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'inscricoes' CHECK (status IN ('inscricoes','andamento','encerrado')),
  rounds INTEGER NOT NULL DEFAULT 3,          -- rodadas suíças
  round_minutes INTEGER NOT NULL DEFAULT 90,  -- tempo-limite da rodada suíça
  final_table INTEGER NOT NULL DEFAULT 1,     -- mesa final com o top 4
  pre_reg INTEGER NOT NULL DEFAULT 0,         -- pré-inscrição: organização aprova cada inscrito
  public INTEGER NOT NULL DEFAULT 1,          -- aparece na lista pública (senão, só pelo link)
  test INTEGER NOT NULL DEFAULT 0,            -- evento de teste: não entra no ranking
  no_bye INTEGER NOT NULL DEFAULT 0,          -- sem bye: completa com mesas de 3
  all_byes_score INTEGER NOT NULL DEFAULT 1,  -- todos os byes valem 3; senão só o 1º de cada jogador
  allow_edit INTEGER NOT NULL DEFAULT 1,      -- organização pode trocar jogadores de mesa numa rodada aberta
  reg_open INTEGER NOT NULL DEFAULT 1,        -- inscrições abertas pelo site
  bye_by_ranking INTEGER NOT NULL DEFAULT 1,  -- bye da rodada 1 para os últimos do ranking anual (estreantes jogam)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  deck TEXT NOT NULL DEFAULT '',
  approved INTEGER NOT NULL DEFAULT 1,
  paid INTEGER NOT NULL DEFAULT 0,
  checked_in INTEGER NOT NULL DEFAULT 0,
  dropped INTEGER NOT NULL DEFAULT 0,
  dq INTEGER NOT NULL DEFAULT 0,             -- desclassificado (ban): sai do evento e não recebe pontos de liga
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, player_id)
);
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'suico' CHECK (kind IN ('suico','final')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  UNIQUE (event_id, number)
);
CREATE TABLE IF NOT EXISTS pods (
  id INTEGER PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  table_no INTEGER NOT NULL,
  bye INTEGER NOT NULL DEFAULT 0,
  result TEXT            -- NULL = em andamento; 'E' = empate; 'V:<entry_id>' = vencedor
);
CREATE TABLE IF NOT EXISTS seats (
  id INTEGER PRIMARY KEY,
  pod_id INTEGER NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  seat INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  pod_id INTEGER NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (pod_id, entry_id)
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY,
  season INTEGER NOT NULL,
  etapa INTEGER NOT NULL,
  date TEXT,
  pos INTEGER NOT NULL,
  player TEXT NOT NULL,
  deck TEXT NOT NULL,
  pts REAL NOT NULL DEFAULT 0,
  tb1 REAL NOT NULL DEFAULT 0,
  tb2 REAL NOT NULL DEFAULT 0,
  tb3 REAL NOT NULL DEFAULT 0,
  v INTEGER NOT NULL DEFAULT 0,
  e INTEGER NOT NULL DEFAULT 0,
  d INTEGER NOT NULL DEFAULT 0,
  ap INTEGER,            -- pontos de liga (1 a 3); NULL enquanto a etapa não foi fechada
  source TEXT NOT NULL DEFAULT 'planilha',
  event_id INTEGER
);
CREATE INDEX IF NOT EXISTS ix_history_season ON history(season, etapa);
-- Uma linha por jogador em cada mesa (histórico de confrontos, decks e conquistas)
CREATE TABLE IF NOT EXISTS hist_games (
  id INTEGER PRIMARY KEY,
  season INTEGER NOT NULL,
  etapa INTEGER NOT NULL,
  round INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'suico',
  pod TEXT NOT NULL,            -- número da mesa ou 'bye'
  player TEXT NOT NULL,
  deck TEXT NOT NULL,
  result TEXT NOT NULL,         -- V, E, D ou B
  source TEXT NOT NULL DEFAULT 'planilha',
  event_id INTEGER
);
CREATE INDEX IF NOT EXISTS ix_hist_games ON hist_games(season, etapa, round, pod);
CREATE TABLE IF NOT EXISTS attempts (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  since INTEGER NOT NULL
);
SQL);
    // Colunas criadas depois da primeira versão: adiciona sem apagar dados
    $add = [
        'events'  => ['reg_open' => 'INTEGER NOT NULL DEFAULT 1', 'bye_by_ranking' => 'INTEGER NOT NULL DEFAULT 1'],
        'entries' => ['dq' => 'INTEGER NOT NULL DEFAULT 0'],
    ];
    foreach ($add as $table => $cols) {
        $have = array_column($pdo->query("PRAGMA table_info($table)")->fetchAll(), 'name');
        foreach ($cols as $c => $def) if (!in_array($c, $have, true)) $pdo->exec("ALTER TABLE $table ADD COLUMN $c $def");
    }
    // Banco criado antes do histórico de mesas: importa uma vez
    if (!$pdo->query('SELECT 1 FROM hist_games LIMIT 1')->fetch()) seed_games($pdo);
}

function seed_games(PDO $pdo): void {
    $f = __DIR__ . '/seed_games.json';
    if (!file_exists($f)) return;
    // Etapas já fechadas pelo sistema têm as mesas do próprio sistema
    $own = array_map(fn($r) => $r['season'] . '-' . $r['etapa'], $pdo->query("SELECT DISTINCT season, etapa FROM history WHERE source = 'sistema'")->fetchAll());
    $st = $pdo->prepare('INSERT INTO hist_games (season,etapa,round,kind,pod,player,deck,result,source) VALUES (?,?,?,?,?,?,?,?,\'planilha\')');
    $pdo->beginTransaction();
    foreach (json_decode(file_get_contents($f), true) ?: [] as $g) {
        if (in_array($g['season'] . '-' . $g['etapa'], $own, true)) continue;
        $st->execute([$g['season'], $g['etapa'], $g['round'], $g['kind'], $g['pod'], $g['player'], $g['deck'], $g['result']]);
    }
    $pdo->commit();
}

// Histórico das etapas já disputadas (gerado da planilha por tools/build_seed.py).
function seed_history(PDO $pdo): void {
    $f = __DIR__ . '/seed.json';
    if (!file_exists($f)) return;
    $rows = json_decode(file_get_contents($f), true) ?: [];
    $st = $pdo->prepare('INSERT INTO history (season,etapa,date,pos,player,deck,pts,tb1,tb2,tb3,v,e,d,ap,source)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,\'planilha\')');
    $pp = $pdo->prepare('INSERT OR IGNORE INTO players (name) VALUES (?)');
    $pdo->beginTransaction();
    foreach ($rows as $r) {
        $st->execute([$r['season'], $r['etapa'], $r['date'], $r['pos'], $r['player'], $r['deck'],
            $r['pts'], $r['tb1'], $r['tb2'], $r['tb3'], $r['v'], $r['e'], $r['d'], $r['ap']]);
        $pp->execute([$r['player']]);
    }
    $pdo->commit();
}

function q(string $sql, array $args = []): PDOStatement {
    $st = db()->prepare($sql);
    $st->execute($args);
    return $st;
}
function one(string $sql, array $args = []): ?array {
    $r = q($sql, $args)->fetch();
    return $r ?: null;
}
function all(string $sql, array $args = []): array {
    return q($sql, $args)->fetchAll();
}

// Recarrega o histórico importado da planilha (seed.json / seed_games.json).
// Só substitui linhas de origem 'planilha'; etapas fechadas pelo sistema não são tocadas.
function reload_seed(): array {
    $pdo = db();
    $own = array_map(fn($r) => $r['season'] . '-' . $r['etapa'], $pdo->query("SELECT DISTINCT season, etapa FROM history WHERE source = 'sistema'")->fetchAll());
    $hist = json_decode(@file_get_contents(__DIR__ . '/seed.json') ?: '[]', true) ?: [];
    $games = json_decode(@file_get_contents(__DIR__ . '/seed_games.json') ?: '[]', true) ?: [];
    if (!$hist) throw new RuntimeException('seed.json ausente ou vazio');
    $pdo->beginTransaction();
    try {
        $pdo->exec("DELETE FROM history WHERE source = 'planilha'");
        $pdo->exec("DELETE FROM hist_games WHERE source = 'planilha'");
        $h = $pdo->prepare('INSERT INTO history (season,etapa,date,pos,player,deck,pts,tb1,tb2,tb3,v,e,d,ap,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,\'planilha\')');
        $pp = $pdo->prepare('INSERT OR IGNORE INTO players (name) VALUES (?)');
        $nh = 0;
        foreach ($hist as $r) {
            if (in_array($r['season'] . '-' . $r['etapa'], $own, true)) continue;
            $h->execute([$r['season'], $r['etapa'], $r['date'], $r['pos'], $r['player'], $r['deck'], $r['pts'], $r['tb1'], $r['tb2'], $r['tb3'], $r['v'], $r['e'], $r['d'], $r['ap']]);
            $pp->execute([$r['player']]); $nh++;
        }
        $g = $pdo->prepare('INSERT INTO hist_games (season,etapa,round,kind,pod,player,deck,result,source) VALUES (?,?,?,?,?,?,?,?,\'planilha\')');
        $ng = 0;
        foreach ($games as $r) {
            if (in_array($r['season'] . '-' . $r['etapa'], $own, true)) continue;
            $g->execute([$r['season'], $r['etapa'], $r['round'], $r['kind'], $r['pod'], $r['player'], $r['deck'], $r['result']]); $ng++;
        }
        $pdo->commit();
    } catch (Throwable $t) { $pdo->rollBack(); throw $t; }
    return ['historico' => $nh, 'mesas' => $ng, 'etapas_do_sistema_preservadas' => count($own)];
}
