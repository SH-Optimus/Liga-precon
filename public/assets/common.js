'use strict';
// Utilitários compartilhados pela página dos jogadores e pela da organização.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pad = n => String(n).padStart(2, '0');

async function api(action, data, params = {}) {
  const qs = new URLSearchParams({ a: action, ...params });
  const opt = data === undefined ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Liga': '1' }, body: JSON.stringify(data) };
  let res, json;
  try { res = await fetch('api.php?' + qs, opt); json = await res.json(); }
  catch { throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.'); }
  if (!res.ok || json.error) throw new Error(json.error || 'Erro ' + res.status);
  return json;
}

let toastT;
function toast(msg, kind = 'ok') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.className = 'toast msg ' + kind; t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, kind === 'err' ? 6000 : 3500);
}

// Datas: o servidor guarda UTC ("2026-10-03 13:00:00"); a tela mostra no horário local
const utc = s => new Date(s.replace(' ', 'T') + 'Z');
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function dateParts(iso) { if (!iso) return null; const [y, m, d] = iso.split('-').map(Number); return { y, m, d, label: `${pad(d)}/${pad(m)}/${y}` }; }
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Cronômetro: diferença entre relógio do servidor e o do aparelho
let clockSkew = 0;
function syncClock(serverNow) { clockSkew = utc(serverNow) - Date.now(); }
function remaining(startedAt, minutes) { return utc(startedAt).getTime() + minutes * 60000 - (Date.now() + clockSkew); }
function fmtTimer(ms) {
  const neg = ms < 0, s = Math.floor(Math.abs(ms) / 1000);
  return (neg ? '−' : '') + (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
}

const STATUS = { inscricoes: ['Inscrições', 'gold'], andamento: ['Em andamento', 'live'], encerrado: ['Encerrado', ''] };
const statusChip = ev => {
  const [l, c] = STATUS[ev.status] || [ev.status, ''];
  return `<span class="chip ${c}">${l}</span>` + (+ev.test ? ' <span class="chip crit">Teste</span>' : '');
};
const resChip = r => r ? `<span class="res ${r}">${{ V: 'Vitória', E: 'Empate', D: 'Derrota', B: 'Bye' }[r]}</span>` : '';
function seatResult(pod, entryId) {
  if (+pod.bye) return 'B';
  if (!pod.result) return null;
  if (pod.result === 'E') return 'E';
  return +pod.result.slice(2) === +entryId ? 'V' : 'D';
}
const roundName = r => r.kind === 'final' ? 'Mesa final' : 'Rodada ' + r.number;
// Link para o perfil público do jogador
const deckLink = n => n ? `<a class="plink" href="./#d/${encodeURIComponent(n)}">${esc(n)}</a>` : '—';
const profLink = n => `<a class="plink" href="./#j/${encodeURIComponent(n)}">${esc(n)}</a>`;

// Tabela de classificação (usada nas duas páginas)
function standingsTable(st, ev, opts = {}) {
  if (!st.length) return '<p class="empty">Ninguém inscrito ainda.</p>';
  const top = +ev.final_table ? 4 : 0;
  return `<div class="scroll"><table><thead><tr><th class="r">#</th><th>Jogador</th><th class="hm">Deck</th><th class="r">Pts</th>
    <th class="c">V-E-D</th><th class="r">TB1</th><th class="r">TB2</th><th class="r">TB3</th>${opts.extra ? opts.extra.head : ''}</tr></thead><tbody>` +
    st.map((s, i) => {
      const out = +s.dropped || +s.dq;
      return `<tr class="${!out && i < top && s.played ? 'top4' : ''} ${out ? 'out' : ''} ${opts.me === s.id ? 'me' : ''}">
      <td class="r num">${s.rank}º</td><td>${profLink(s.name)}${+s.dq ? ' <span class="chip crit">desclassificado</span>' : +s.dropped ? ' <span class="chip">drop</span>' : ''}</td>
      <td class="hm muted">${deckLink(s.deck)}</td><td class="r num"><b>${s.pts}</b></td><td class="c num">${s.v}-${s.e}-${s.d}${+s.byes ? ` <span class="muted">+${s.byes}B</span>` : ''}</td>
      <td class="r num">${fmt(s.tb1)}</td><td class="r num">${fmt(s.tb2, 2)}</td><td class="r num">${fmt(s.tb3, 2)}</td>${opts.extra ? opts.extra.row(s) : ''}</tr>`;
    }).join('') + '</tbody></table></div>';
}

function podCard(pod, round, opts = {}) {
  if (+pod.bye) return `<div class="pod done"><div class="ph"><span class="tn">Bye</span><span class="muted small">3 pontos, sem jogo</span></div>
    ${pod.seats.map(s => `<div class="seat"><span class="sn">–</span><span class="nm">${esc(s.name)}</span>${resChip('B')}</div>`).join('')}</div>`;
  const mine = opts.me && pod.seats.some(s => +s.entry_id === opts.me);
  return `<div class="pod ${pod.result ? 'done' : ''} ${mine ? 'me' : ''}" data-pod="${pod.id}">
    <div class="ph"><span class="tn">${round.kind === 'final' ? 'Mesa final' : 'Mesa ' + pod.table_no}</span>
      ${pod.result ? (pod.result === 'E' ? '<span class="chip">Empate</span>' : '<span class="chip gold">Resultado</span>') : '<span class="chip live">jogando</span>'}</div>
    ${pod.seats.map(s => `<div class="seat"><span class="sn" title="Ordem na mesa">${s.seat}</span>
      <span class="nm">${profLink(s.name)}<span class="dk">${deckLink(s.deck)}</span></span>${resChip(seatResult(pod, s.entry_id))}</div>`).join('')}
    ${opts.footer ? opts.footer(pod) : ''}</div>`;
}

/* ---------- Fim do tempo da rodada: faixa + aviso sonoro ---------- */
const SOUND_KEY = 'liga.som';
const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; } };
let audioCtx = null;
// Navegadores só liberam áudio depois de um toque/clique na página
function unlockAudio() {
  try { audioCtx ??= new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch {}
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { passive: true }));
function beep() {
  if (!soundOn()) return;
  unlockAudio();
  if (audioCtx) {
    const t0 = audioCtx.currentTime;
    [0, .25, .5, 1.1, 1.35, 1.6].forEach(dt => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.25, t0 + dt + .02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + .18);
      o.connect(g).connect(audioCtx.destination); o.start(t0 + dt); o.stop(t0 + dt + .2);
    });
  }
  try { navigator.vibrate?.([300, 150, 300, 150, 600]); } catch {}
}
function soundButton() {
  return `<button type="button" class="ghost sm" data-sound aria-pressed="${soundOn()}">${soundOn() ? '🔔 Som ligado' : '🔕 Som desligado'}</button>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sound]');
  if (!b) return;
  const on = !soundOn();
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch {}
  $$('[data-sound]').forEach(x => { x.setAttribute('aria-pressed', String(on)); x.textContent = on ? '🔔 Som ligado' : '🔕 Som desligado'; });
  if (on) beep();   // toca uma vez para testar e liberar o áudio
});

const lastLeft = {};
function tickTimers() {
  let over = false;
  $$('.timer').forEach(t => {
    const ms = remaining(t.dataset.start, +t.dataset.min), id = t.dataset.round;
    t.textContent = ms >= 0 ? fmtTimer(ms) : 'Tempo! ' + fmtTimer(ms);
    t.classList.toggle('over', ms < 0);
    if (ms < 0) over = true;
    // Toca só ao cruzar o zero com a página aberta (não ao abrir uma rodada já estourada)
    if (id && lastLeft[id] !== undefined && lastLeft[id] >= 0 && ms < 0) {
      let done = false;
      try { done = localStorage.getItem('liga.bipe.' + id) === '1'; localStorage.setItem('liga.bipe.' + id, '1'); } catch {}
      if (!done) beep();
    }
    if (id) lastLeft[id] = ms;
  });
  let bar = $('#timeup');
  if (over && !bar) {
    bar = document.createElement('div'); bar.id = 'timeup'; bar.className = 'timeup'; bar.setAttribute('role', 'alert');
    bar.textContent = '⏰ Tempo esgotado: último turno';
    document.body.prepend(bar);
  } else if (!over && bar) bar.remove();
}
setInterval(tickTimers, 1000);
