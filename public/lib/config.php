<?php
// Configuração do sistema da Liga Precon.
// DATA_DIR deve ficar FORA do public_html. Padrão: /home/<usuario>/liga-data
// (sobe 4 níveis a partir de public_html/mtg/liga/lib).
const DATA_DIR = __DIR__ . '/../../../../liga-data';

// Token exigido para criar o primeiro login de organizador (tela "Configurar" do admin.html).
// Troque por outro valor se quiser; depois de criar o primeiro organizador ele não é mais usado.
const SETUP_TOKEN = '__SETUP_TOKEN__';

// Temporada padrão dos eventos novos e do ranking.
const SEASON = 2026;

// Regras da liga (Regulamento Liga Precon 2026)
const ROUND_MINUTES = 90;      // tempo-limite das rodadas suíças
const SWISS_ROUNDS = 3;        // rodadas suíças por evento
const POD_SIZE = 4;            // jogadores por mesa
const BAN_MIN_GAMES = 24;      // banimento por performance: mínimo de partidas
const BAN_WINRATE = 1/3;       // ...e win rate SUPERIOR a 33,33% (regulamento)
const ANNUAL_TOP = 8;          // 1º = 3 pts de liga, 2º ao 8º = 2, demais = 1
