<?php
// Imita a pasta mtg do servidor: página do ranking em /, sistema em /liga/, com a CSP rígida do site
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($path, '/liga/')) { $root = __DIR__ . '/../public'; $path = substr($path, 5); }
else $root = __DIR__ . '/../ranking';
if ($path === '/' || $path === '') $path = '/index.html';
if (str_starts_with($path, '/lib/')) { http_response_code(403); exit('proibido'); }
$file = realpath($root . $path);
if (!$file || !str_starts_with($file, realpath($root))) { http_response_code(404); exit('não encontrado'); }
if (str_ends_with($file, '.php')) { chdir(dirname($file)); require $file; return; }
$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css', 'js' => 'text/javascript', 'json' => 'application/json', 'jpg' => 'image/jpeg', 'png' => 'image/png'];
header('Content-Type: ' . ($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
readfile($file);
