<?php
putenv('LIGA_DATA_DIR=' . sys_get_temp_dir() . '/liga-season-' . getmypid());
require __DIR__ . '/../public/lib/season.php';
echo json_encode(season_data(2026), JSON_UNESCAPED_UNICODE);
