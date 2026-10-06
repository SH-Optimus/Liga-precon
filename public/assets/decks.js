'use strict';
// Páginas de decks: lista, mapa de confrontos (deck × deck) e página de cada deck.
const riskChip = r => r === 'Banido' ? '<span class="chip crit">banido</span>' : r === 'Alto' ? '<span class="chip crit">risco alto</span>' : r === 'Médio' ? '<span class="chip gold">risco médio</span>' : '';
const heat = c => !c ? 'nn' : c[0] <= -3 ? 'm3' : c[0] === -2 ? 'm2' : c[0] === -1 ? 'm1' : c[0] === 0 ? 'z' : c[0] === 1 ? 'p1' : c[0] === 2 ? 'p2' : 'p3';
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

async function viewDecks(tab) {
  document.title = 'Decks · Liga Precon BH';
  app.innerHTML = '<p class="empty">Carregando…</p>';
  let o;
  try { o = await api('decks_overview'); } catch (e) { app.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }
  const t = tab === 'mapa' ? 'mapa' : 'lista';
  app.innerHTML = `<div class="row between"><h1>Decks</h1><span class="muted small">${o.decks.length} decks na temporada ${o.season}</span></div>
    <div class="tabs" role="tablist"><button role="tab" aria-selected="${t === 'lista'}" data-t="lista">Lista</button><button role="tab" aria-selected="${t === 'mapa'}" data-t="mapa">Mapa de confrontos</button></div>
    <section id="dkBody"></section>`;
  $$('.tabs [data-t]').forEach(b => b.onclick = () => { location.hash = b.dataset.t === 'mapa' ? '#decks/mapa' : '#decks'; });
  const body = $('#dkBody');
  if (t === 'lista') {
    body.innerHTML = `<div class="card"><div class="row between"><input type="search" id="qd" placeholder="Buscar deck" aria-label="Buscar deck"></div>
      <div class="scroll"><table><thead><tr><th>Deck</th><th class="r">Partidas</th><th class="c">V-E-D</th><th class="r">Win rate</th><th class="r hm">Pilotos</th><th class="r hm">Títulos</th></tr></thead><tbody id="dkRows"></tbody></table></div>
      <p class="muted small">Inclui a mesa final; byes não contam. Banimento: mais de ${fmt(33.33, 2)}% de vitórias com pelo menos 24 partidas.</p></div>`;
    const draw = () => {
      const q = $('#qd').value.trim().toLowerCase();
      $('#dkRows').innerHTML = o.decks.filter(d => d.n.toLowerCase().includes(q)).map(d => `<tr><td>${deckLink(d.n)} ${riskChip(d.risk)}</td><td class="r num">${d.p}</td><td class="c num">${d.v}-${d.e}-${d.d}</td>
        <td class="r num ${d.wr > 33.33 ? 'bad' : ''}">${fmt(d.wr, 1)}%</td><td class="r num hm">${d.pil}</td><td class="r num hm">${d.titulos ? '🏆'.repeat(d.titulos) : ''}</td></tr>`).join('')
        || '<tr><td colspan="6" class="empty">Nenhum deck encontrado.</td></tr>';
    };
    $('#qd').oninput = draw; draw();
    return;
  }
  // Mapa de confrontos
  body.innerHTML = `<div class="card"><div class="row between"><p class="small">Saldo de vitórias do deck da <b>linha</b> contra o da <b>coluna</b>: em cada mesa, quem vence soma +1 contra cada deck derrotado. Inclui a mesa final. Clique numa célula para ver as mesas.</p>
    <label class="row">Mínimo de partidas <select id="minP"><option>6</option><option selected>10</option><option>15</option><option value="0">todos</option></select></label></div>
    <div class="legend-h"><span class="hm3">−3</span><span class="hm2">−2</span><span class="hm1">−1</span><span class="hz">0</span><span class="hp1">+1</span><span class="hp2">+2</span><span class="hp3">+3</span><span class="hnn">não se enfrentaram</span></div>
    <div class="scroll heatwrap" id="heat"></div></div>`;
  const draw = () => {
    const min = +$('#minP').value, ds = o.decks.filter(d => d.p >= min).map(d => d.n);
    $('#heat').innerHTML = `<table class="heat"><thead><tr><th class="corner"></th>${ds.map(b => `<th class="ch"><span>${esc(b)}</span></th>`).join('')}</tr></thead><tbody>
      ${ds.map(a => `<tr><th class="rh">${deckLink(a)}</th>${ds.map(b => {
        if (a === b) return '<td class="self"></td>';
        const c = o.cells[a]?.[b];
        return c ? `<td class="h${heat(c)}"><a href="./#d/${encodeURIComponent(a)}/${encodeURIComponent(b)}" title="${esc(a)} × ${esc(b)}: ${c[1]} mesa(s) · ${esc(a)} venceu ${c[2]}, ${esc(b)} venceu ${c[3]}, ${c[4]} empate(s)">${c[0] ? sgn(c[0]) : '0'}</a></td>`
                 : `<td class="hnn" title="${esc(a)} × ${esc(b)}: nunca se enfrentaram"></td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;
  };
  $('#minP').onchange = draw; draw();
}

async function viewDeck(name, vs) {
  app.innerHTML = '<p class="empty">Carregando…</p>';
  let d;
  try { d = await api('deck', undefined, { name }); } catch (e) { app.innerHTML = `<div class="msg err">${esc(e.message)}</div><p><a href="./#decks">← Decks</a></p>`; return; }
  document.title = d.nome + ' · Liga Precon BH';
  const s = d.stats, need = Math.max(0, d.regra_ban.min - s.p);
  const stat = (b, t) => `<div class="stat"><b>${b}</b><span>${t}</span></div>`;
  const mrow = m => `<div class="mu"><span>${deckLink(m.deck)}</span><b class="${m.saldo > 0 ? 'good' : 'bad'}">${sgn(m.saldo)}</b><small class="muted">${m.n} mesa(s) · ${m.w}V ${m.l}D ${m.e}E</small></div>`;
  app.innerHTML = `<p class="small"><a href="./#decks">← Decks</a></p>
  <section class="card">
    <div class="row between"><div class="stack"><span class="eyebrow">Deck · temporada ${d.season}</span><h1>${esc(d.nome)}</h1></div>${riskChip(s.risk)}</div>
    <div class="stats">${stat(s.p, 'partidas')}${stat(`${s.v}-${s.e}-${s.d}`, 'vitórias-empates-derrotas')}${stat(fmt(s.wr, 1) + '%', 'win rate')}
      ${stat(s.pil, 'pilotos')}${stat(s.titulos ? '🏆'.repeat(s.titulos) : '0', 'títulos de etapa')}${stat(d.confrontos.length, 'decks enfrentados')}</div>
    <p class="small">${s.banned ? `<b>Banido por performance</b> (mais de ${fmt(d.regra_ban.wr, 2)}% com ${s.p} partidas).`
      : need ? `Faltam <b>${need}</b> partida(s) para entrar no critério de banimento (${d.regra_ban.min} partidas e mais de ${fmt(d.regra_ban.wr, 2)}% de vitórias).`
      : `Já tem as ${d.regra_ban.min} partidas do critério; é banido se o win rate passar de ${fmt(d.regra_ban.wr, 2)}%.`}</p>
    ${d.titulos.length ? `<p class="small">🏆 ${d.titulos.map(t => `Etapa ${pad(t.etapa)} com ${profLink(t.piloto)}`).join(' · ')}</p>` : ''}
  </section>
  <div class="grid2">
    <section class="card"><h2>Confrontos favoráveis</h2>${d.favoraveis.length ? d.favoraveis.map(mrow).join('') : '<p class="muted">Nenhum saldo positivo ainda.</p>'}</section>
    <section class="card"><h2>Confrontos desfavoráveis</h2>${d.desfavoraveis.length ? d.desfavoraveis.map(mrow).join('') : '<p class="muted">Nenhum saldo negativo ainda.</p>'}</section>
  </div>
  <section class="card"><h2>Pilotos</h2><div class="scroll"><table><thead><tr><th>Jogador</th><th class="r">Etapas</th><th class="c">V-E-D</th><th class="r">Win rate</th><th class="r">Melhor</th></tr></thead><tbody>
    ${d.pilotos.map(p => `<tr><td>${profLink(p.nome)}</td><td class="r num">${p.etapas}</td><td class="c num">${p.v}-${p.e}-${p.d}</td><td class="r num">${fmt(p.wr, 1)}%</td><td class="r num">${p.melhor}º</td></tr>`).join('')}
  </tbody></table></div></section>
  <section class="card"><h2>Etapa a etapa</h2><div class="scroll"><table><thead><tr><th>Etapa</th><th class="r">Pilotos</th><th class="c">V-E-D</th><th class="r">Melhor</th><th class="r">Win rate acumulado</th></tr></thead><tbody>
    ${d.evolucao.map(e => `<tr><td class="num">${pad(e.etapa)}</td><td class="r num">${e.pilotos}</td><td class="c num">${e.v}-${e.e}-${e.d}</td><td class="r num">${e.melhor}º <span class="muted">/ ${e.n}</span></td><td class="r num">${fmt(e.wr_acum, 1)}% <span class="muted">(${e.jogos})</span></td></tr>`).join('')}
  </tbody></table></div></section>
  <section class="card" id="secMu"><div class="row between"><h2>Todos os confrontos</h2><input type="search" id="qm" placeholder="Buscar deck" aria-label="Buscar deck"></div>
    <p class="muted small">Clique num confronto para ver as mesas. “Outro venceu”: mesa vencida por um terceiro deck.</p>
    <div id="muList"></div></section>`;
  const res = r => resChip(r);
  const mesa = m => `<div class="mesa"><span class="eyebrow">Etapa ${pad(m.etapa)} · ${m.final ? 'mesa final' : 'rodada ' + m.round + ' · mesa ' + esc(m.pod)}</span>
    ${m.rows.map(r => `<div class="seat"><span class="sn">${r.deck === d.nome ? '★' : ''}</span><span class="nm">${profLink(r.player)}<span class="dk">${esc(r.deck)}</span></span>${res(r.result)}</div>`).join('')}</div>`;
  const drawMu = () => {
    const q = ($('#qm').value || '').trim().toLowerCase();
    $('#muList').innerHTML = d.confrontos.filter(c => c.deck.toLowerCase().includes(q)).map(c => `<details class="muitem" data-vs="${esc(c.deck)}" ${vs && c.deck.toLowerCase() === vs.toLowerCase() ? 'open' : ''}>
      <summary><span class="nm">${esc(c.deck)}</span><b class="${c.saldo > 0 ? 'good' : c.saldo < 0 ? 'bad' : ''}">${c.saldo ? sgn(c.saldo) : '0'}</b>
        <small class="muted">${c.n} mesa(s) · ${c.w} vitória(s) · ${c.l} derrota(s) para ele · ${c.e} empate(s)${c.x ? ` · ${c.x} outro venceu` : ''}</small></summary>
      <div class="mesas">${c.mesas.map(mesa).join('')}<p class="small"><a href="./#d/${encodeURIComponent(c.deck)}">Ver página do ${esc(c.deck)} →</a></p></div></details>`).join('')
      || '<p class="empty">Nenhum confronto.</p>';
  };
  $('#qm').oninput = drawMu; drawMu();
  if (vs) { const el = $$('#muList details').find(x => x.dataset.vs.toLowerCase() === vs.toLowerCase()); el?.scrollIntoView({ block: 'center' }); }
}
