'use strict';
// Modo TV: tela para a loja durante o evento. Atualiza sozinha; sem interação necessária.
const tv = $('#tv');
const PAGE_MS = 12000;          // tempo de cada página quando as mesas ou a classificação não cabem
let evId = +new URLSearchParams(location.search).get('e') || null;
let data = null, page = 0;
// Quantos itens cabem por página; diminui sozinho se a tela não comportar (ver fitScreen)
const FIT0 = { pods: 6, st: 12, names: 30 };
let fit = { ...FIT0 };
addEventListener('resize', () => { fit = { ...FIT0 }; if (data) render(); });

$('#tvFull').onclick = () => {
  try { const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); p?.catch?.(() => {}); } catch {}
};
document.addEventListener('fullscreenchange', () => { $('#tvFull').textContent = document.fullscreenElement ? '⤢ Sair da tela cheia' : '⛶ Tela cheia'; });

async function pickEvent() {
  const { events } = await api('events');
  const ev = events.find(e => e.status === 'andamento') || events.find(e => e.status === 'inscricoes') || events[0];
  return ev ? +ev.id : null;
}

async function load() {
  try {
    if (!evId) evId = await pickEvent();
    if (!evId) { tv.innerHTML = '<p class="tvmsg">Nenhum evento cadastrado.</p>'; return; }
    data = await api('event', undefined, { id: evId });
    syncClock(data.now);
    fit = { ...FIT0 };   // recalcula o que cabe a cada atualização
    render();
  } catch (e) { if (!data) tv.innerHTML = `<p class="tvmsg">${esc(e.message)}</p>`; }
}

// Divide uma lista em páginas que cabem na tela e alterna entre elas
function paged(items, perPage) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const p = page % pages;
  return { items: items.slice(p * perPage, (p + 1) * perPage), pages, p };
}
const dots = (pages, p) => pages > 1 ? `<div class="tvdots">${Array.from({ length: pages }, (_, i) => `<i class="${i === p ? 'on' : ''}"></i>`).join('')}</div>` : '';

function standingsPanel(d, perPage, title = 'Classificação') {
  const st = d.standings.filter(s => s.played && !+s.dq);
  if (!st.length) return '';
  const { items, pages, p } = paged(st, perPage);
  const top = +d.event.final_table ? 4 : 0;
  return `<section class="tvpanel"><h2>${title}</h2>
    <table class="tvst"><thead><tr><th>#</th><th>Jogador</th><th class="r">Pts</th><th class="r">TB1</th><th class="r">TB2</th></tr></thead><tbody>
    ${items.map(s => `<tr class="${st.indexOf(s) < top ? 'top4' : ''} ${+s.dropped ? 'out' : ''}"><td class="num">${s.rank}º</td><td>${esc(s.name)}</td><td class="r num"><b>${s.pts}</b></td><td class="r num">${fmt(s.tb1)}</td><td class="r num">${fmt(s.tb2, 2)}</td></tr>`).join('')}
    </tbody></table>${dots(pages, p)}</section>`;
}

function podTV(pod, round) {
  if (+pod.bye) return '';
  const r = pod.result;
  return `<div class="tvpod ${r ? 'done' : ''}"><div class="tvph"><b>${round.kind === 'final' ? 'Mesa final' : 'Mesa ' + pod.table_no}</b>
      ${r ? (r === 'E' ? '<span class="chip">Empate</span>' : '<span class="chip gold">Resultado</span>') : '<span class="chip live">jogando</span>'}</div>
    ${pod.seats.map(s => { const sr = seatResult(pod, s.entry_id); return `<div class="tvseat ${sr === 'V' ? 'win' : ''}"><span class="sn">${s.seat}</span><span class="nm">${esc(s.name)}<small>${esc(s.deck || '')}</small></span>${resChip(sr)}</div>`; }).join('')}</div>`;
}

function render(tries = 0) {
  const d = data, ev = d.event, cur = d.rounds[d.rounds.length - 1];
  $('#tvTitle').innerHTML = `${esc(ev.title)}${cur ? ` · <span>${roundName(cur)}</span>` : ''}`;
  $('#tvSound').innerHTML = cur && cur.status === 'aberta' && cur.kind === 'suico' ? soundButton() : '';
  let html;
  if (ev.status === 'encerrado') {
    const st = d.standings.filter(s => s.played && !+s.dq);
    const fin = d.rounds.find(r => r.kind === 'final')?.pods[0];
    const champ = fin && fin.result && fin.result !== 'E' ? fin.seats.find(s => +s.entry_id === +fin.result.slice(2))?.name : (d.absolute_winner || st[0]?.name);
    html = `<div class="tvchamp"><span class="eyebrow">Campeão</span><div class="big">🏆 ${esc(champ || '—')}</div>
      <p>${esc(st.find(s => s.name === champ)?.deck || '')}</p></div>${standingsPanel(d, Math.min(8, fit.st), 'Classificação do suíço')}`;
  } else if (!cur) {
    const ents = d.entries.filter(e => !+e.dq);
    const { items, pages, p } = paged(ents, fit.names);
    html = `<div class="tvwait"><span class="eyebrow">${ev.status === 'inscricoes' && +ev.reg_open ? 'Inscrições abertas' : 'Aguardando a 1ª rodada'}</span>
      <div class="big">${ents.length} inscritos</div><p class="tvurl">Inscreva-se e acompanhe sua mesa: <b>${esc(location.host + location.pathname.replace(/tv\.html$/, ''))}</b></p></div>
      <section class="tvpanel"><div class="tvnames">${items.map(e => `<span>${esc(e.name)}</span>`).join('')}</div>${dots(pages, p)}</section>`;
  } else if (cur.status === 'aberta') {
    const pods = cur.pods.filter(p => !+p.bye), byes = cur.pods.filter(p => +p.bye).flatMap(p => p.seats.map(s => s.name));
    const per = cur.kind === 'final' ? 1 : fit.pods;
    const { items, pages, p } = paged(pods, per);
    html = `<div class="tvround">
      <div class="tvclock">${cur.kind === 'suico' ? `<span class="eyebrow">Tempo restante</span><div class="timer" data-round="${cur.id}" data-start="${cur.started_at}" data-min="${d.rules.round_minutes}"></div>` : '<span class="eyebrow">Mesa final</span><div class="tvnolimit">sem limite de tempo</div>'}
        <span class="muted">${pods.filter(x => x.result).length} de ${pods.length} mesa(s) com resultado</span></div>
      <div class="tvpods ${cur.kind === 'final' ? 'final' : items.length <= 4 ? 'few' : ''}">${items.map(x => podTV(x, cur)).join('')}</div>${dots(pages, p)}
      ${byes.length ? `<p class="tvbye">Bye (3 pontos): <b>${byes.map(esc).join(', ')}</b></p>` : ''}</div>
      ${cur.kind === 'suico' ? standingsPanel(d, fit.st) : ''}`;
  } else {
    html = `<div class="tvwait"><span class="eyebrow">${roundName(cur)} encerrada</span><div class="big">Aguardando a próxima rodada</div></div>${standingsPanel(d, fit.st)}`;
  }
  tv.innerHTML = html;
  tickTimers();
  fitScreen(tries);
}

// Se algo passar da altura da tela, mostra menos itens por página (o resto entra no rodízio)
function fitScreen(tries) {
  if (tries > 12) return;
  // transborda: o conteúdo é maior que o espaço do quadro, ou passa do fim da tela
  const H = innerHeight - 4;
  const over = s => $$(s).some(e => e.scrollHeight > e.clientHeight + 2 || e.getBoundingClientRect().bottom > H);
  let changed = false;
  if (over('.tvpanel')) {
    if (fit.st > 4) { fit.st--; changed = true; }
    if (fit.names > 8) { fit.names -= 4; changed = true; }
  }
  if ((over('.tvround') || over('.tvpods')) && fit.pods > 1) { fit.pods = fit.pods > 4 ? 4 : fit.pods - 1; changed = true; }
  if (changed) render(tries + 1);
}

load();
setInterval(load, 10000);
setInterval(() => { page++; if (data) render(); }, PAGE_MS);
