'use strict';
// Página dos jogadores: lista de eventos, inscrição, minha mesa, mesas, classificação.
const app = $('#app');
let state = { ev: null, tab: null }, pollT = null;
const meKey = id => 'liga.me.' + id;
const getMe = id => { try { return +localStorage.getItem(meKey(id)) || null; } catch { return null; } };
const setMe = (id, v) => { try { v ? localStorage.setItem(meKey(id), v) : localStorage.removeItem(meKey(id)); } catch {} };

addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', route);

function route() {
  clearInterval(pollT);
  const h = location.hash;
  const m = h.match(/^#e\/(\d+)(?:\/(\w+))?/), j = h.match(/^#j\/(.+)$/), dk = h.match(/^#d\/([^/]+)(?:\/(.+))?$/);
  if (m) { state.tab = m[2] || null; loadEvent(+m[1]); pollT = setInterval(() => loadEvent(+m[1], true), 15000); }
  else if (j) viewProfile(decodeURIComponent(j[1]));
  else if (dk) viewDeck(decodeURIComponent(dk[1]), dk[2] ? decodeURIComponent(dk[2]) : null);
  else if (h === '#decks' || h === '#decks/mapa') viewDecks(h === '#decks/mapa' ? 'mapa' : 'lista');
  else if (h === '#jogadores') viewPlayers();
  else if (h === '#conquistas') viewAchievements();
  else listEvents();
  scrollTo(0, 0);
}

async function listEvents() {
  try {
    const { events } = await api('events');
    document.title = 'Liga Precon BH · Eventos';
    app.innerHTML = `<div class="row between"><h1>Eventos</h1></div>` + (events.length ? `<div class="evs">${events.map(ev => {
      const d = dateParts(ev.date);
      return `<a class="card ev" href="#e/${ev.id}"><span class="dt"><b>${d ? pad(d.d) : '–'}</b><small>${d ? MES[d.m - 1] : ''}</small></span>
        <span><b>${esc(ev.title)}</b><br><span class="muted small">${ev.etapa ? 'Etapa ' + pad(ev.etapa) + ' · ' : ''}${ev.n} inscritos${ev.start_time ? ' · ' + ev.start_time : ''}</span></span>
        ${statusChip(ev)}</a>`;
    }).join('')}</div>` : '<div class="card empty">Nenhum evento aberto no momento.</div>');
  } catch (e) { app.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

async function loadEvent(id, quiet) {
  try {
    const data = await api('event', undefined, { id });
    syncClock(data.now);
    // Não redesenha enquanto o jogador digita
    if (quiet && (document.activeElement?.matches('input,select,textarea') || $('#dlg').open)) { state.data = data; return; }
    state.data = data; renderEvent();
  } catch (e) { if (!quiet) app.innerHTML = `<div class="msg err">${esc(e.message)}</div><p><a href="#">← Voltar aos eventos</a></p>`; }
}

function currentRound(d) { return d.rounds.length ? d.rounds[d.rounds.length - 1] : null; }

function renderEvent() {
  const d = state.data, ev = d.event, me = getMe(ev.id), cur = currentRound(d);
  const meEntry = d.entries.find(e => +e.id === me) || null;
  if (me && !meEntry) setMe(ev.id, null);
  document.title = ev.title + ' · Liga Precon BH';
  const tabs = [['mesa', 'Minha mesa'], ['mesas', 'Mesas'], ['class', 'Classificação'], ['inscritos', `Inscritos (${d.entries.length})`]];
  const tab = state.tab || (meEntry && cur ? 'mesa' : cur ? 'mesas' : 'inscritos');
  const dp = dateParts(ev.date);
  const timer = cur && cur.status === 'aberta' && cur.kind === 'suico'
    ? `<div class="timerbox"><div><span class="eyebrow">${roundName(cur)} · tempo restante</span><div class="timer" data-round="${cur.id}" data-start="${cur.started_at}" data-min="${d.rules.round_minutes}"></div></div>${soundButton()}</div>` : '';
  app.innerHTML = `
  <p class="small"><a href="#">← Eventos</a></p>
  <section class="card">
    <div class="row between"><div class="stack">
      <span class="eyebrow">${ev.etapa ? 'Etapa ' + pad(ev.etapa) + ' · ' : ''}Temporada ${ev.season}</span>
      <h1>${esc(ev.title)}</h1>
      <span class="muted small">${dp ? dp.label : 'Data a definir'}${ev.start_time ? ' · ' + ev.start_time : ''} · ${d.entries.length} participantes · ${d.rules.swiss_rounds} rodadas${+ev.final_table ? ' + mesa final' : ''}</span>
    </div>${statusChip(ev)}</div>
    ${ev.description ? `<p class="small">${esc(ev.description)}</p>` : ''}
    ${d.absolute_winner ? `<div class="msg ok">🏆 <b>${esc(d.absolute_winner)}</b> venceu todas as rodadas: vitória absoluta, sem mesa final.</div>` : ''}
    ${timer}
  </section>
  ${registerCard(d)}
  ${whoCard(d, meEntry)}
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${l}</button>`).join('')}</div>
  <section id="tabBody">${{ mesa: tabMesa, mesas: tabMesas, class: tabClass, inscritos: tabInscritos }[tab](d, meEntry)}</section>`;
  $$('.tabs button').forEach(b => b.onclick = () => { location.hash = `#e/${ev.id}/${b.dataset.tab}`; });
  bind(d, meEntry);
  tickTimers();
}

function registerCard(d) {
  const ev = d.event;
  if (ev.status === 'encerrado' || !+ev.reg_open) return '';
  return `<details class="card" ${d.entries.length ? '' : 'open'}><summary><b>Inscrever-se${+ev.pre_reg ? ' (pré-inscrição)' : ''}</b></summary>
    <form class="form" id="regForm" autocomplete="off">
      <label>Nome (como na liga)<input name="name" list="dlPlayers" maxlength="40" required></label>
      <label>Deck<input name="deck" list="dlDecks" maxlength="60" required></label>
      <label>PIN (4 a 6 números)<input name="pin" inputmode="numeric" pattern="\\d{4,6}" maxlength="6" required type="password"></label>
      <button class="pri" type="submit">Inscrever</button>
    </form>
    <p class="muted small">O PIN protege seu nome: você vai usá-lo para reportar resultados. Se já jogou a liga, use seu nome de sempre; na primeira vez, o PIN que você digitar fica valendo.</p>
    ${d.banned.length ? `<p class="small"><b>Decks banidos por performance:</b> ${d.banned.map(esc).join(', ')}.</p>` : ''}
    <datalist id="dlPlayers"></datalist><datalist id="dlDecks"></datalist></details>`;
}

function whoCard(d, meEntry) {
  if (!d.entries.length) return '';
  return `<div class="card row between"><label class="row">Quem é você?
    <select id="whoSel"><option value="">— escolha seu nome —</option>${d.entries.filter(e => !+e.dq).map(e => `<option value="${e.id}" ${meEntry && +meEntry.id === +e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
    <span class="muted small">Fica salvo neste aparelho para mostrar sua mesa.</span></div>`;
}

function myPod(round, me) { return round?.pods.find(p => p.seats.some(s => +s.entry_id === me)) || null; }

function tabMesa(d, meEntry) {
  if (!meEntry) return '<div class="card empty">Escolha seu nome acima para ver sua mesa.</div>';
  const me = +meEntry.id, cur = currentRound(d);
  let html = '';
  if (+meEntry.dropped || +meEntry.dq) html += `<div class="msg warn">Você ${+meEntry.dq ? 'foi desclassificado' : 'saiu (drop)'} deste evento.</div>`;
  if (!cur) html += '<div class="card empty">As mesas ainda não foram sorteadas. Fique de olho: esta página atualiza sozinha.</div>';
  else {
    const pod = myPod(cur, me);
    if (!pod) html += `<div class="card empty">Você não está na ${roundName(cur).toLowerCase()}.</div>`;
    else if (+pod.bye) html += `<div class="hero-me"><span class="eyebrow">${roundName(cur)}</span><div class="big">Bye</div><p>Você não joga esta rodada e recebe 3 pontos.</p></div>`;
    else {
      const seat = pod.seats.find(s => +s.entry_id === me), r = seatResult(pod, me);
      const myRep = pod.reports.find(x => +x.entry_id === me);
      html += `<div class="hero-me">
        <div class="row between"><div><span class="eyebrow">${roundName(cur)}</span><div class="big">${cur.kind === 'final' ? 'Mesa final' : 'Mesa ' + pod.table_no}</div></div>
          <div><span class="eyebrow">Sua posição</span><div class="big">${seat.seat}º</div></div></div>
        <div class="stack">${pod.seats.map(s => `<div class="seat"><span class="sn">${s.seat}</span><span class="nm">${esc(s.name)}${+s.entry_id === me ? ' <span class="muted">(você)</span>' : ''}<span class="dk">${esc(s.deck || '—')}</span></span>${resChip(seatResult(pod, s.entry_id))}</div>`).join('')}</div>
        <p class="muted small">O 1º joga primeiro e a ordem segue a numeração. Corte o deck de quem está à sua direita.</p>
        ${r ? `<div class="msg ok">Resultado registrado: ${resChip(r)}</div>`
            : cur.status === 'aberta' ? `<div class="row"><button class="pri" id="btnReport" data-pod="${pod.id}">Reportar resultado</button>${myRep ? '<span class="muted small">Você já reportou; aguardando confirmação.</span>' : ''}</div>` : ''}
      </div>`;
    }
  }
  // Campanha no evento
  const rows = d.rounds.map(r => { const p = myPod(r, me); return p ? `<tr><td>${roundName(r)}</td><td>${+p.bye ? '—' : (r.kind === 'final' ? 'Final' : 'Mesa ' + p.table_no)}</td><td>${resChip(seatResult(p, me)) || '<span class="muted">jogando</span>'}</td></tr>` : ''; }).join('');
  const st = d.standings.find(s => +s.id === me);
  if (rows) html += `<div class="card"><div class="row between"><h2>Sua campanha</h2>${st ? `<span class="chip gold">${st.rank}º · ${st.pts} pts</span>` : ''}</div>
    <div class="scroll"><table><thead><tr><th>Rodada</th><th>Mesa</th><th>Resultado</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  if (!+meEntry.dropped && !+meEntry.dq && d.event.status !== 'encerrado') html += `<p class="small"><button class="ghost danger" id="btnDrop">Sair do evento (drop)</button></p>`;
  return html;
}

function tabMesas(d, meEntry) {
  if (!d.rounds.length) return '<div class="card empty">As mesas ainda não foram sorteadas.</div>';
  return [...d.rounds].reverse().map(r => `<div class="card round"><div class="rh"><h2>${roundName(r)}</h2>
    <span class="muted small">${r.status === 'aberta' ? 'em andamento' : 'encerrada'} · início ${hhmm(utc(r.started_at))}</span></div>
    <div class="pods">${r.pods.map(p => podCard(p, r, { me: meEntry ? +meEntry.id : null })).join('')}</div></div>`).join('');
}

function tabClass(d, meEntry) {
  return `<div class="card"><div class="row between"><h2>Classificação</h2><span class="muted small">Desempate como no EMP: TB1, TB2, TB3</span></div>
    ${standingsTable(d.standings, d.event, { me: meEntry ? +meEntry.id : null })}
    <p class="muted small"><b>TB1</b>: rodadas sem derrota valem 2 (menos depois de derrotas ou byes seguidos). <b>TB2</b>: média de pontos dos oponentes. <b>TB3</b>: média do TB1 dos oponentes.</p></div>`;
}

function tabInscritos(d) {
  if (!d.entries.length) return '<div class="card empty">Ninguém inscrito ainda. Seja o primeiro!</div>';
  return `<div class="card"><div class="scroll"><table><thead><tr><th>Jogador</th><th>Deck</th></tr></thead><tbody>
    ${d.entries.map(e => `<tr class="${+e.dropped || +e.dq ? 'out' : ''}"><td>${profLink(e.name)}</td><td class="muted">${deckLink(e.deck)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function bind(d, meEntry) {
  const ev = d.event;
  $('#whoSel')?.addEventListener('change', e => { setMe(ev.id, e.target.value); state.tab = 'mesa'; renderEvent(); });
  const rf = $('#regForm');
  if (rf) {
    Promise.all([api('players'), api('decks', undefined, { season: ev.season })]).then(([p, k]) => {
      $('#dlPlayers').innerHTML = p.players.map(n => `<option value="${esc(n)}">`).join('');
      $('#dlDecks').innerHTML = k.decks.filter(x => !k.banned.includes(x)).map(n => `<option value="${esc(n)}">`).join('');
    }).catch(() => {});
    rf.onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(rf));
      try {
        const r = await api('register', { event_id: ev.id, ...f });
        toast(r.msg);
        await loadEvent(ev.id);
        const mine = state.data.entries.find(x => x.name.toLowerCase() === f.name.trim().toLowerCase());
        if (mine) { setMe(ev.id, mine.id); renderEvent(); }
      } catch (err) { toast(err.message, 'err'); }
    };
  }
  $('#btnReport')?.addEventListener('click', e => openReport(d, +e.currentTarget.dataset.pod, +meEntry.id));
  $('#btnDrop')?.addEventListener('click', () => openDrop(d, meEntry));
}

function openReport(d, podId, me) {
  const r = d.rounds.find(r => r.pods.some(p => +p.id === podId)), pod = r.pods.find(p => +p.id === podId);
  const f = $('#dlgForm');
  f.innerHTML = `<h2>Resultado · ${r.kind === 'final' ? 'Mesa final' : 'Mesa ' + pod.table_no}</h2>
    <div class="opts">${pod.seats.map(s => `<label class="opt"><input type="radio" name="outcome" value="V:${s.entry_id}" required> Vitória de ${esc(s.name)}</label>`).join('')}
      <label class="opt"><input type="radio" name="outcome" value="E"> Empate (tempo ou perda simultânea)</label></div>
    <label>Seu PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" required autocomplete="off"></label>
    <p class="muted small">Quando dois jogadores da mesa reportam o mesmo resultado, ele é confirmado. Em caso de divergência, a organização decide.</p>
    <div class="row"><button class="pri" value="ok">Enviar</button><button value="cancel" formnovalidate>Cancelar</button></div>`;
  f.onsubmit = async e => {
    if (e.submitter?.value !== 'ok') return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    try { const res = await api('report', { pod_id: podId, entry_id: me, pin: v.pin, outcome: v.outcome }); $('#dlg').close(); toast(res.msg); loadEvent(d.event.id); }
    catch (err) { toast(err.message, 'err'); }
  };
  $('#dlg').showModal();
}

function openDrop(d, meEntry) {
  const f = $('#dlgForm');
  f.innerHTML = `<h2>Sair do evento?</h2><p>Você não será pareado nas próximas rodadas. Seus resultados até aqui continuam valendo.</p>
    <label>Seu PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" required autocomplete="off"></label>
    <div class="row"><button class="pri" value="ok">Confirmar drop</button><button value="cancel" formnovalidate>Cancelar</button></div>`;
  f.onsubmit = async e => {
    if (e.submitter?.value !== 'ok') return;
    e.preventDefault();
    try { const r = await api('drop', { entry_id: meEntry.id, pin: new FormData(f).get('pin') }); $('#dlg').close(); toast(r.msg); loadEvent(d.event.id); }
    catch (err) { toast(err.message, 'err'); }
  };
  $('#dlg').showModal();
}
