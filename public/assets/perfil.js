'use strict';
// Perfis públicos dos jogadores e conquistas da temporada.
const RAR = { comum: 'Comum', incomum: 'Incomum', rara: 'Rara', mitica: 'Mítica' };
const et2 = e => 'Etapa ' + pad(e);

async function viewPlayers() {
  document.title = 'Jogadores · Liga Precon BH';
  app.innerHTML = '<p class="empty">Carregando…</p>';
  try {
    const s = await api('season');
    app.innerHTML = `<div class="row between"><h1>Jogadores</h1><input type="search" id="qp" placeholder="Buscar jogador" aria-label="Buscar jogador"></div>
      <div class="card"><div class="scroll"><table><thead><tr><th class="r">#</th><th>Jogador</th><th class="r">Pontos</th><th class="r">Etapas</th><th class="r">Jogos</th><th class="c hm">V-E-D</th><th class="r hm">Win rate</th></tr></thead>
      <tbody id="plBody"></tbody></table></div><p class="muted small">Jogos = mesas jogadas, incluindo a mesa final; byes não contam.</p></div>`;
    const nEt = {}, total = new Set(s.reg.map(r => r.et)).size;
    s.reg.forEach(r => { const k = r.j.toLowerCase(); nEt[k] = (nEt[k] || 0) + 1; });
    const draw = () => {
      const q = $('#qp').value.trim().toLowerCase();
      $('#plBody').innerHTML = s.pl.filter(p => p.n.toLowerCase().includes(q)).map(p =>
        `<tr class="${p.rk <= 10 ? 'top4' : ''}"><td class="r num">${p.rk}º</td><td>${profLink(p.n)}</td><td class="r num"><b>${fmt(p.pts)}</b></td><td class="r num">${nEt[p.n.toLowerCase()] || 0}<span class="muted">/${total}</span></td><td class="r num">${p.v + p.e + p.d}</td><td class="c num hm">${p.v}-${p.e}-${p.d}</td><td class="r num hm">${fmt(p.wr, 1)}%</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty">Ninguém encontrado.</td></tr>';
    };
    $('#qp').oninput = draw; draw();
  } catch (e) { app.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

function badge(a, locked) {
  const reps = a.repetivel && a.etapas?.length > 1 ? ` <b class="x">×${a.etapas.length}</b>` : '';
  return `<div class="ach rar-${a.raridade} ${locked ? 'locked' : ''}" data-ach="${a.id}" title="${esc(a.desc)}">
    <span class="ic" aria-hidden="true">${a.icon}</span>
    <span class="tx"><b>${esc(a.nome)}${reps}</b><small>${esc(a.desc)}</small>
    <small class="meta">${RAR[a.raridade]} · ${fmt(a.pct, 1)}% dos jogadores${!locked && a.etapas ? ' · ' + a.etapas.map(et2).join(', ') : ''}</small></span></div>`;
}

// Gráfico da posição no ranking depois de cada etapa (1º no topo)
function evoChart(evo, total) {
  const pts = evo.filter(e => e.rk);
  if (pts.length < 2) return '';
  const W = 640, H = 200, m = { l: 34, r: 16, t: 14, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(10, ...pts.map(e => e.rk)), n = evo.length;
  const x = i => m.l + (n === 1 ? iw / 2 : i / (n - 1) * iw), y = r => m.t + (r - 1) / (max - 1) * ih;
  const ticks = [1, 10, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i && v <= max);
  let s = `<svg class="evo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Posição no ranking anual depois de cada etapa">`;
  ticks.forEach(t => { s += `<line class="gl ${t === 10 ? 'g10' : ''}" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tk" x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}º</text>`; });
  const line = evo.map((e, i) => e.rk ? `${x(i)},${y(e.rk)}` : null).filter(Boolean).join(' ');
  s += `<polyline class="ln" points="${line}"/>`;
  evo.forEach((e, i) => {
    s += `<text class="tk" x="${x(i)}" y="${H - 6}" text-anchor="middle">${pad(e.etapa)}</text>`;
    if (e.rk) s += `<circle class="pt ${e.played ? '' : 'miss'}" cx="${x(i)}" cy="${y(e.rk)}" r="5"><title>${et2(e.etapa)}: ${e.rk}º no ranking, ${fmt(e.pts)} pts${e.played ? '' : ' (não jogou)'}</title></circle>`;
  });
  return s + '</svg>';
}

async function viewProfile(name) {
  app.innerHTML = '<p class="empty">Carregando…</p>';
  let p;
  try { p = await api('player', undefined, { name }); } catch (e) { app.innerHTML = `<div class="msg err">${esc(e.message)}</div><p><a href="./#jogadores">← Jogadores</a></p>`; return; }
  document.title = p.nome + ' · Liga Precon BH';
  const r = p.ranking || {}, played = p.evolucao.filter(e => e.played);
  const gap = r.rk > 10 && p.top10 ? `<b>${fmt(p.top10.pts - r.pts)}</b> pts para o top 10 (10º: ${esc(p.top10.nome)}, ${fmt(p.top10.pts)} pts)` : r.rk ? 'Dentro do top 10' : '—';
  const best = played.length ? Math.min(...played.map(e => e.pos)) : null;
  const stat = (b, s) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`;
  app.innerHTML = `<p class="small"><a href="./#jogadores">← Jogadores</a></p>
  <section class="card">
    <div class="row between"><div class="stack"><span class="eyebrow">Temporada ${p.season}</span><h1>${esc(p.nome)}</h1></div>
      ${r.rk ? `<span class="chip gold">${r.rk}º de ${p.total_jogadores} no ranking</span>` : ''}</div>
    <div class="stats">
      ${stat(r.pts != null ? fmt(r.pts) : '—', 'pontos de liga')}${stat(r.v != null ? `${r.v}-${r.e}-${r.d}` : '—', 'vitórias-empates-derrotas')}
      ${stat(r.wr != null ? fmt(r.wr, 1) + '%' : '—', 'win rate')}${stat(`${played.length}/${p.evolucao.length}`, 'etapas jogadas')}
      ${stat(best ? best + 'º' : '—', 'melhor colocação')}${stat(p.oponentes, 'oponentes diferentes')}${stat(p.conquistas.length, 'conquistas')}
    </div>
    <p class="small">${gap}</p>
    ${p.conquistas.length ? `<div class="achbar" aria-label="Conquistas">${p.conquistas.map(a => `<button type="button" class="achmini rar-${a.raridade}" data-goach="${a.id}" title="${esc(a.nome)} · ${RAR[a.raridade]}">${a.icon}</button>`).join('')}</div>` : ''}
  </section>
  <section class="card"><h2>Evolução no ranking</h2>${evoChart(p.evolucao, p.total_jogadores) || '<p class="muted">Aparece depois de duas etapas.</p>'}
    <div class="scroll"><table><thead><tr><th>Etapa</th><th class="r">Posição</th><th>Deck</th><th class="c">V-E-D</th><th class="r">Pts liga</th><th class="r hm">Ranking</th></tr></thead><tbody>
    ${p.evolucao.map(e => e.played
      ? `<tr><td class="num">${pad(e.etapa)}</td><td class="r num">${e.pos}º <span class="muted">/ ${e.n}</span></td><td>${deckLink(e.deck)}</td><td class="c num">${e.v}-${e.e}-${e.d}</td><td class="r num">${e.ap == null ? '<span class="muted">—</span>' : '<b>+' + e.ap + '</b>'}</td><td class="r num hm">${e.rk ? e.rk + 'º' : '—'}</td></tr>`
      : `<tr class="out"><td class="num">${pad(e.etapa)}</td><td colspan="4">não jogou</td><td class="r num hm">${e.rk ? e.rk + 'º' : '—'}</td></tr>`).join('')}
    </tbody></table></div></section>
  <section class="card"><h2>Decks</h2>${p.decks.length ? `<div class="scroll"><table><thead><tr><th>Deck</th><th class="r">Etapas</th><th class="c">V-E-D</th><th class="r">Win rate</th><th class="r hm">Na liga</th><th class="r">Títulos</th></tr></thead><tbody>
    ${p.decks.map(d => `<tr><td>${deckLink(d.deck)}${d.risk === 'Banido' ? ' <span class="chip crit">banido</span>' : d.risk === 'Alto' ? ' <span class="chip crit">risco alto</span>' : ''}</td><td class="r num">${d.etapas}</td><td class="c num">${d.v}-${d.e}-${d.d}</td>
      <td class="r num"><b>${fmt(d.wr, 1)}%</b></td><td class="r num hm muted">${d.liga_wr != null ? fmt(d.liga_wr, 1) + '%' : '—'}</td><td class="r num">${d.titulos ? '🏆'.repeat(d.titulos) : ''}</td></tr>`).join('')}
    </tbody></table></div><p class="muted small">Inclui a mesa final; byes não contam. “Na liga” é o win rate do deck somando todos os pilotos.</p>` : '<p class="muted">Sem partidas.</p>'}</section>
  <section class="card"><div class="row between"><h2>Confronto direto</h2><input type="search" id="qh" placeholder="Buscar oponente" aria-label="Buscar oponente"></div>
    ${p.h2h.length ? `<div class="scroll"><table><thead><tr><th>Oponente</th><th class="r">Mesas</th><th class="r">Vitórias suas</th><th class="r">Vitórias dele</th><th class="r">Empates</th><th class="r hm">Outro venceu</th></tr></thead><tbody id="h2hBody"></tbody></table></div>
    <p class="muted small">Mesas em que os dois jogaram juntos (as mesas são de 4 jogadores, então às vezes um terceiro vence).</p>` : '<p class="muted">Sem mesas registradas.</p>'}</section>
  <section class="card" id="secConq"><h2>Conquistas <span class="muted small">${p.conquistas.length} de ${p.conquistas.length + p.faltam.length}</span></h2>
    <div class="achs">${p.conquistas.map(a => badge(a, false)).join('')}</div>
    ${p.faltam.length ? `<details><summary><b>Ainda faltam ${p.faltam.length}</b></summary><div class="achs">${p.faltam.map(a => badge(a, true)).join('')}</div></details>` : ''}
  </section>`;
  const drawH = () => {
    const q = ($('#qh')?.value || '').trim().toLowerCase(), b = $('#h2hBody');
    if (!b) return;
    b.innerHTML = p.h2h.filter(h => h.nome.toLowerCase().includes(q)).map(h => `<tr><td>${profLink(h.nome)}</td><td class="r num">${h.n}</td>
      <td class="r num ${h.v > h.d ? 'good' : ''}">${h.v}</td><td class="r num ${h.d > h.v ? 'bad' : ''}">${h.d}</td><td class="r num">${h.e}</td><td class="r num hm muted">${h.x}</td></tr>`).join('')
      || '<tr><td colspan="6" class="empty">Ninguém encontrado.</td></tr>';
  };
  // Ícone do topo: rola até a conquista e destaca
  $$('[data-goach]').forEach(b => b.onclick = () => {
    const el = $(`#secConq [data-ach="${b.dataset.goach}"]`) || $('#secConq');
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  });
  if ($('#qh')) $('#qh').oninput = drawH;
  drawH();
}

async function viewAchievements() {
  document.title = 'Conquistas · Liga Precon BH';
  app.innerHTML = '<p class="empty">Carregando…</p>';
  let o;
  try { o = await api('achievements'); } catch (e) { app.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }
  const cat = Object.fromEntries(o.catalog.map(c => [c.id, c]));
  const groups = [...new Set(o.catalog.map(c => c.grupo))];
  app.innerHTML = `<div class="row between"><h1>Conquistas</h1><span class="muted small">${o.catalog.length} conquistas · ${o.jogadores} jogadores na temporada</span></div>
  <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-t="todas">Todas</button><button role="tab" aria-selected="false" data-t="etapas">Por etapa</button></div>
  <section id="achTodas">${groups.map(g => `<div class="card"><h2>${esc(g)}</h2><div class="achs">${o.catalog.filter(c => c.grupo === g).map(c => `
      <details class="achd">${'<summary>' + badge(c, c.holders.length === 0) + '</summary>'}
      <p class="small">${c.holders.length ? c.holders.map(profLink).join(', ') : '<span class="muted">Ninguém ainda.</span>'}</p></details>`).join('')}</div></div>`).join('')}</section>
  <section id="achEtapas" hidden>${o.feed.map(f => `<div class="card"><h2>${et2(f.etapa)}</h2><ul class="feed">${f.items.map(i => {
      const c = cat[i.id];
      return `<li><span class="ic">${c.icon}</span> ${profLink(i.player)} ${i.repeat ? 'conquistou de novo' : 'desbloqueou'} <b class="rar-t rar-${c.raridade}">${esc(c.nome)}</b></li>`;
    }).join('')}</ul></div>`).join('') || '<div class="card empty">Nenhuma conquista ainda.</div>'}</section>`;
  $$('.tabs [data-t]').forEach(b => b.onclick = () => {
    $$('.tabs [data-t]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $('#achTodas').hidden = b.dataset.t !== 'todas'; $('#achEtapas').hidden = b.dataset.t !== 'etapas';
  });
}
