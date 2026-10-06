'use strict';
// Página da organização.
const app = $('#app');
let st = { id: null, tab: 'part', data: null };

addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', route);
$('#logout').onclick = async e => { e.preventDefault(); await api('logout', {}); location.hash = ''; route(); };

async function route() {
  let me;
  try { me = await api('me'); } catch (e) { app.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; return; }
  $('#logout').hidden = !me.admin;
  if (!me.admin) return me.needs_setup ? setupView() : loginView();
  const m = location.hash.match(/^#e\/(\d+)(?:\/(\w+))?/);
  if (m) { st.id = +m[1]; st.tab = m[2] || st.tab || 'part'; return loadEvent(); }
  listView();
}

/* ---------- acesso ---------- */
function loginView() {
  app.innerHTML = `<section class="card"><h1>Entrar</h1>
    <form class="form" id="f"><label>Usuário<input name="user" required autocomplete="username"></label>
    <label>Senha<input name="pass" type="password" required autocomplete="current-password"></label><button class="pri">Entrar</button></form></section>`;
  $('#f').onsubmit = async e => { e.preventDefault(); try { await api('login', Object.fromEntries(new FormData(e.target))); route(); } catch (err) { toast(err.message, 'err'); } };
}
function setupView() {
  app.innerHTML = `<section class="card"><h1>Configurar o sistema</h1>
    <p>Crie o primeiro login de organizador. O token de configuração está no arquivo <code>lib/config.php</code> (SETUP_TOKEN).</p>
    <form class="form" id="f"><label>Token de configuração<input name="token" required></label>
    <label>Usuário<input name="user" required autocomplete="username"></label>
    <label>Senha (mín. 8)<input name="pass" type="password" minlength="8" required autocomplete="new-password"></label><button class="pri">Criar</button></form></section>`;
  $('#f').onsubmit = async e => { e.preventDefault(); try { await api('setup', Object.fromEntries(new FormData(e.target))); toast('Pronto! Você já está logado.'); route(); } catch (err) { toast(err.message, 'err'); } };
}

/* ---------- lista de eventos ---------- */
async function listView() {
  const { events } = await api('events');
  app.innerHTML = `<div class="row between"><h1>Eventos</h1><button class="pri" id="btnNew">+ Criar evento</button></div>
    ${events.length ? `<div class="evs">${events.map(ev => {
      const d = dateParts(ev.date);
      return `<a class="card ev" href="#e/${ev.id}"><span class="dt"><b>${d ? pad(d.d) : '–'}</b><small>${d ? MES[d.m - 1] : ''}</small></span>
      <span><b>${esc(ev.title)}</b><br><span class="muted small">${ev.etapa ? 'Etapa ' + pad(ev.etapa) + ' · ' : 'Sem etapa · '}${ev.n} inscritos${+ev.public ? '' : ' · privado'}</span></span>${statusChip(ev)}</a>`;
    }).join('')}</div>` : '<div class="card empty">Nenhum evento criado.</div>'}
    <section id="impFinals"></section>
    <details class="card"><summary><b>Backup e exportação</b></summary>
      <p class="small">Baixe os dados da liga a qualquer momento. As planilhas saem em CSV no mesmo formato das planilhas da organização (separador “;” e vírgula decimal), prontas para abrir no Excel ou importar no Google Planilhas.</p>
      <div class="exp">
        <a class="btn pri" href="api.php?a=export&amp;t=banco">💾 Banco completo (backup)</a>
        <a class="btn" href="api.php?a=export&amp;t=registro">Registro de jogos (tab_registrojogos)</a>
        <a class="btn" href="api.php?a=export&amp;t=mesas">Mesas (resultados por mesa)</a>
        <a class="btn" href="api.php?a=export&amp;t=ranking">Ranking anual</a>
        <a class="btn" href="api.php?a=export&amp;t=decks">Ranking de decks</a>
        <a class="btn" href="api.php?a=export&amp;t=confrontos">Matriz de confrontos</a>
      </div>
      <p class="muted small">O <b>banco completo</b> tem tudo: eventos, rodadas, histórico, jogadores e logins (as senhas e PINs ficam protegidos por criptografia). Guarde uma cópia depois de cada etapa. Para restaurar, a cópia substitui o arquivo <code>liga.sqlite</code> da pasta <code>liga-data</code> no servidor.</p>
    </details>
    <details class="card"><summary><b>Organizadores</b></summary>
      <form class="form" id="fAdm"><label>Usuário<input name="user" required></label><label>Senha (mín. 8)<input name="pass" type="password" minlength="8" required></label><button>Salvar organizador</button></form>
      <p class="muted small">Cria um novo login ou troca a senha de um existente.</p>
      <form class="form" id="fPin"><label>Apagar PIN do jogador<input name="name" required></label><button>Apagar PIN</button></form>
      <p class="muted small">Para quem esqueceu o PIN: ele define um novo na próxima inscrição.</p></details>
    <details class="card"><summary><b>Histórico da planilha</b></summary>
      <p class="small">Recarrega as etapas importadas da planilha da liga (resultados e mesas) a partir dos arquivos que vieram no último pacote do sistema.
      Use só quando o pacote trouxer correções da planilha. <b>Etapas fechadas pelo sistema não são alteradas</b>, nem eventos, jogadores ou logins.</p>
      <div class="row"><button id="bSeed">Recarregar histórico da planilha</button></div></details>`;
  $('#btnNew').onclick = () => eventForm();
  importedFinals();
  $('#bSeed').onclick = async () => {
    if (!confirm('Recarregar o histórico da planilha? Só as etapas importadas da planilha são substituídas; etapas fechadas pelo sistema ficam como estão.')) return;
    try { toast((await api('reload_seed', {})).msg); } catch (err) { toast(err.message, 'err'); }
  };
  $('#fAdm').onsubmit = async e => { e.preventDefault(); try { toast((await api('admin_add', Object.fromEntries(new FormData(e.target)))).msg); e.target.reset(); } catch (err) { toast(err.message, 'err'); } };
  $('#fPin').onsubmit = async e => { e.preventDefault(); try { toast((await api('pin_reset', Object.fromEntries(new FormData(e.target)))).msg); e.target.reset(); } catch (err) { toast(err.message, 'err'); } };
}

const FLAGS = [
  ['final_table', 'Mesa final com o top 4', 1],
  ['pre_reg', 'Pré-inscrição (organização aprova cada inscrito)', 0],
  ['public', 'Evento público (aparece na lista)', 1],
  ['test', 'Evento de teste (não entra no ranking)', 0],
  ['no_bye', 'Desabilitar bye (completa com mesas de 3)', 0],
  ['bye_by_ranking', 'Bye da 1ª rodada para os últimos do ranking anual (estreantes jogam)', 1],
  ['all_byes_score', 'Todos os byes pontuam (senão, só o 1º de cada jogador)', 1],
  ['allow_edit', 'Permitir ajuste de rodadas (trocar jogadores de mesa)', 1],
];
function eventForm(ev = {}) {
  const f = $('#dlgForm');
  const v = (k, d) => ev[k] ?? d;
  f.innerHTML = `<h2>${ev.id ? 'Configurações do evento' : 'Criar evento'}</h2>
    <label>Nome<input name="title" required maxlength="80" value="${esc(v('title', 'Liga Precon BH ' + new Date().getFullYear() + ' - Etapa '))}"></label>
    <div class="form"><label>Etapa<input name="etapa" type="number" min="1" max="99" value="${esc(v('etapa', ''))}"></label>
      <label>Temporada<input name="season" type="number" min="2020" max="2100" value="${esc(v('season', new Date().getFullYear()))}"></label></div>
    <div class="form"><label>Data<input name="date" type="date" value="${esc(v('date', ''))}"></label><label>Hora<input name="start_time" type="time" value="${esc(v('start_time', '10:00'))}"></label></div>
    <div class="form"><label>Rodadas suíças<input name="rounds" type="number" min="1" max="10" value="${esc(v('rounds', 3))}"></label>
      <label>Tempo por rodada (min)<input name="round_minutes" type="number" min="10" max="300" value="${esc(v('round_minutes', 90))}"></label></div>
    <div class="stack">${FLAGS.map(([k, l, d]) => `<label class="chk"><input type="checkbox" name="${k}" ${+v(k, d) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <label>Descrição<textarea name="description" rows="3" maxlength="2000">${esc(v('description', ''))}</textarea></label>
    <div class="row"><button class="pri" value="ok">${ev.id ? 'Salvar' : 'Criar evento'}</button><button value="cancel" formnovalidate>Cancelar</button></div>`;
  f.onsubmit = async e => {
    if (e.submitter?.value !== 'ok') return;
    e.preventDefault();
    const fd = new FormData(f), body = Object.fromEntries(fd);
    FLAGS.forEach(([k]) => { body[k] = fd.has(k) ? 1 : 0; });
    if (ev.id) body.id = ev.id;
    try { const r = await api('event_save', body); $('#dlg').close(); toast('Evento salvo.'); location.hash = '#e/' + r.id; route(); }
    catch (err) { toast(err.message, 'err'); }
  };
  $('#dlg').showModal();
}

/* ---------- painel do evento ---------- */
async function loadEvent() {
  try { st.data = await api('event', undefined, { id: st.id }); syncClock(st.data.now); render(); }
  catch (e) { app.innerHTML = `<div class="msg err">${esc(e.message)}</div><p><a href="admin.html">← Eventos</a></p>`; }
}
const act = (fn, msg) => async (...a) => { try { await fn(...a); if (msg) toast(msg); await loadEvent(); } catch (e) { toast(e.message, 'err'); } };

function render() {
  const d = st.data, ev = d.event, dp = dateParts(ev.date);
  const cur = d.rounds[d.rounds.length - 1];
  const nApproved = d.entries.filter(e => +e.approved).length, nIn = d.entries.filter(e => +e.checked_in && !+e.dropped && !+e.dq && +e.approved).length;
  const pend = d.entries.filter(e => !+e.approved).length;
  app.innerHTML = `<p class="small"><a href="admin.html">← Eventos</a> · <a href="./#e/${ev.id}" target="_blank">ver página pública ↗</a></p>
  <section class="card">
    <div class="row between"><div class="stack"><span class="eyebrow">${ev.etapa ? 'Etapa ' + pad(ev.etapa) + ' · ' : 'Sem etapa · '}Temporada ${ev.season}</span><h1>${esc(ev.title)}</h1>
      <span class="muted small">Início: ${dp ? dp.label : 'sem data'}${ev.start_time ? ' ' + ev.start_time : ''} · ${nApproved} participantes · ${nIn} presentes${pend ? ` · <b>${pend} aguardando aprovação</b>` : ''}</span></div>
      <div class="row">${statusChip(ev)} ${+ev.reg_open && ev.status !== 'encerrado' ? '<span class="chip gold">inscrições abertas</span>' : ''}</div></div>
    ${cur && cur.status === 'aberta' && cur.kind === 'suico' ? `<div class="timerbox"><div><span class="eyebrow">${roundName(cur)} · tempo restante</span><div class="timer" data-round="${cur.id}" data-start="${cur.started_at}" data-min="${d.rules.round_minutes}"></div></div>${soundButton()}</div>` : ''}
    <div class="row">
      ${ev.status !== 'encerrado' ? `<button id="bReg">${+ev.reg_open ? 'Encerrar inscrições' : 'Reabrir inscrições'}</button>` : ''}
      <button id="bCfg">⚙ Configurações</button>
      <a class="btn pri" href="tv.html?e=${ev.id}" target="_blank" rel="noopener" title="Abre a tela para a TV da loja numa aba nova">📺 Modo TV</a>
      <a class="btn" href="api.php?a=export&amp;t=evento&amp;id=${ev.id}" title="Classificação e mesas deste evento em CSV">⬇ Baixar resultado</a>
      ${ev.status === 'encerrado' ? '<button id="bReopen">Reabrir evento</button>' : `<button class="gold" id="bClose">Fechar evento</button>`}
      ${ev.status !== 'encerrado' ? '<button class="danger" id="bDel">Cancelar evento</button>' : ''}
    </div>
  </section>
  <div class="tabs" role="tablist">${[['part', 'Participantes'], ['rodada', 'Rodada atual'], ['hist', 'Histórico']].map(([k, l]) => `<button role="tab" aria-selected="${st.tab === k}" data-tab="${k}">${l}</button>`).join('')}</div>
  <section id="body">${{ part: tabPart, rodada: tabRodada, hist: tabHist }[st.tab](d)}</section>`;
  $$('.tabs button').forEach(b => b.onclick = () => { location.hash = `#e/${ev.id}/${b.dataset.tab}`; });
  tickTimers();
  $('#bReg')?.addEventListener('click', act(() => api('reg_toggle', { id: ev.id, open: +ev.reg_open ? 0 : 1 })));
  $('#bCfg').onclick = () => eventForm(ev);
  $('#bDel')?.addEventListener('click', async () => { if (confirm(`Cancelar e APAGAR o evento “${ev.title}” com inscrições e rodadas?`)) { try { await api('event_delete', { id: ev.id }); location.hash = ''; } catch (e) { toast(e.message, 'err'); } } });
  $('#bReopen')?.addEventListener('click', act(() => confirm('Reabrir? Os pontos desta etapa saem do ranking até fechar de novo.') && api('event_reopen', { event_id: ev.id }), 'Evento reaberto.'));
  $('#bClose')?.addEventListener('click', closePreview);
  bindTab(d);
}

function tabPart(d) {
  const ev = d.event, closed = ev.status === 'encerrado';
  const byId = Object.fromEntries(d.entries.map(e => [e.id, e]));
  const rows = d.standings.map(s => ({ ...s, ...byId[s.id] }));
  const chk = (e, k, l) => `<label class="chk" title="${l}"><input type="checkbox" data-e="${e.id}" data-k="${k}" ${+e[k] ? 'checked' : ''} ${closed ? 'disabled' : ''}></label>`;
  return `<div class="card">
    ${closed ? '' : `<form class="form" id="fAdd" autocomplete="off"><label>Adicionar jogador<input name="name" list="dlP" required maxlength="40"></label>
      <label>Deck<input name="deck" list="dlD" maxlength="60"></label><label class="chk"><input type="checkbox" name="checked_in" checked> já presente</label><button class="pri">Adicionar</button></form>
      <datalist id="dlP"></datalist><datalist id="dlD"></datalist>
      <div class="row"><button id="bAll" class="sm">Marcar todos como presentes</button><span class="muted small">Só jogadores aprovados, presentes e sem drop entram no pareamento.</span></div>`}
    <div class="scroll"><table><thead><tr><th class="r">#</th><th>Jogador</th><th>Deck</th><th class="r">Pts</th><th class="c hm">V-E-D</th><th class="r hm">TB1</th><th class="r hm">TB2</th><th class="r hm">TB3</th>
      ${+ev.pre_reg ? '<th class="c">Aprov.</th>' : ''}<th class="c">Pago</th><th class="c">Presente</th><th class="c">Drop</th><th class="c">Ban</th><th></th></tr></thead><tbody>
    ${rows.map(e => `<tr class="${+e.dropped || +e.dq ? 'out' : ''} ${+e.approved ? '' : 'me'}"><td class="r num">${e.played ? e.rank + 'º' : '–'}</td><td>${esc(e.name)}</td>
      <td><input type="text" data-deck="${e.id}" value="${esc(e.deck)}" list="dlD" maxlength="60" ${closed ? 'disabled' : ''}></td>
      <td class="r num"><b>${e.pts}</b></td><td class="c num hm">${e.v}-${e.e}-${e.d}</td><td class="r num hm">${fmt(e.tb1)}</td><td class="r num hm">${fmt(e.tb2, 2)}</td><td class="r num hm">${fmt(e.tb3, 2)}</td>
      ${+ev.pre_reg ? `<td class="c">${chk(e, 'approved', 'Aprovado')}</td>` : ''}<td class="c">${chk(e, 'paid', 'Pago')}</td><td class="c">${chk(e, 'checked_in', 'Presente')}</td>
      <td class="c">${chk(e, 'dropped', 'Drop')}</td><td class="c">${chk(e, 'dq', 'Desclassificar')}</td>
      <td>${e.played || closed ? '' : `<button class="ghost danger sm" data-del="${e.id}" title="Excluir inscrição">✕</button>`}</td></tr>`).join('') || '<tr><td colspan="14" class="empty">Ninguém inscrito.</td></tr>'}
    </tbody></table></div>
    <p class="muted small"><b>Drop</b>: sai das próximas rodadas, mas os resultados continuam valendo. <b>Ban</b>: desclassificado; não recebe pontos de liga nem entra na mesa final.</p></div>`;
}

function podAdmin(pod, r, d) {
  return podCard(pod, r, {
    footer: p => {
      if (+p.bye) return '';
      const reps = p.reports.map(x => {
        const who = p.seats.find(s => +s.entry_id === +x.entry_id)?.name, o = x.outcome === 'E' ? 'empate' : 'vitória de ' + (p.seats.find(s => +s.entry_id === +x.outcome.slice(2))?.name || '?');
        return `<li>${esc(who)} reportou <b>${esc(o)}</b></li>`;
      });
      const conflict = new Set(p.reports.map(x => x.outcome)).size > 1;
      // Rodada fechada: resultado travado (já foi usado no pareamento das próximas rodadas)
      if (r.status !== 'aberta') return '';
      return `${reps.length ? `<ul class="small ${conflict ? 'msg warn' : ''}">${reps.join('')}</ul>` : ''}
        <label>Resultado<select data-pod="${p.id}"><option value="">— em andamento —</option>
          ${p.seats.map(s => `<option value="V:${s.entry_id}" ${p.result === 'V:' + s.entry_id ? 'selected' : ''}>Vitória de ${esc(s.name)}</option>`).join('')}
          <option value="E" ${p.result === 'E' ? 'selected' : ''}>Empate</option></select></label>`;
    }
  });
}

function tabRodada(d) {
  const ev = d.event, cur = d.rounds[d.rounds.length - 1];
  const swiss = d.rounds.filter(r => r.kind === 'suico').length, hasFinal = d.rounds.some(r => r.kind === 'final');
  const canNext = ev.status !== 'encerrado' && (!cur || cur.status === 'fechada');
  let ctl = '';
  if (canNext && swiss < d.rules.swiss_rounds) ctl = `<button class="pri" id="bGen">Gerar rodada ${swiss + 1}</button>`;
  else if (canNext && +ev.final_table && !hasFinal && !d.absolute_winner) ctl = finalBox(d);
  else if (canNext && ev.status !== 'encerrado') ctl = `<span class="msg ok">Todas as rodadas concluídas${d.absolute_winner ? ` · vitória absoluta de <b>${esc(d.absolute_winner)}</b>` : ''}. Use “Fechar evento”.</span>`;
  const open = d.rounds.find(r => r.status === 'aberta');
  if (!cur) return `<div class="card"><div class="row">${ctl}</div><p class="muted">Faça o check-in dos jogadores na aba Participantes e gere a rodada 1. A 1ª rodada é sorteada; as seguintes agrupam por pontos e evitam repetir oponentes.</p></div>`;
  const pending = cur.pods.filter(p => !+p.bye && !p.result).length;
  return `<div class="card round"><div class="rh"><h2>${roundName(cur)}</h2><div class="row">
      ${cur.status === 'aberta' ? `<button class="pri" id="bCloseR" ${pending ? 'disabled' : ''}>Fechar rodada${pending ? ` (${pending} sem resultado)` : ''}</button>` : `<span class="chip">fechada</span>${ev.status !== 'encerrado' ? ' <button class="sm" id="bReopenR">Reabrir</button>' : ''}`}
      ${ev.status !== 'encerrado' ? '<button class="sm danger" id="bDelR">Desfazer rodada</button>' : ''}</div></div>
    <div class="row">${ctl}</div>
    <div class="pods">${cur.pods.map(p => podAdmin(p, cur, d)).join('')}</div>
    ${open && +ev.allow_edit && cur.kind === 'suico' ? swapForm(cur) : ''}</div>`;
}

// Final: escolher os finalistas (padrão: top 4 sem drop) e/ou publicar o suíço se a final for em outro dia
function finalBox(d) {
  const elig = d.standings.filter(s => !+s.dq && s.played);
  let n = 0;
  const pre = new Set(elig.filter(s => !+s.dropped && n++ < 4).map(s => s.id));
  const top = elig.filter(s => pre.has(s.id));
  return `<div class="card finalbox"><h3>Mesa final</h3>
    <p class="small">Finalistas (top 4 do suíço): <b>${top.map(s => esc(s.name)).join(', ')}</b></p>

    <div class="row"><button class="gold" id="bFinal">Gerar mesa final</button></div>
    <hr><p class="small"><b>A final vai ser em outro dia?</b> Publique o suíço: a etapa aparece no ranking como “final pendente”. No dia da final, volte aqui, gere a mesa final, escolha o vencedor e feche o evento.</p>
    <div class="row"><button id="bPublish">Publicar suíço (final pendente)</button></div></div>`;
}

// Etapas que vieram da planilha/EMP com a final pendente: só falta lançar o vencedor
async function importedFinals() {
  let r; try { r = await api('imported_finals'); } catch { return; }
  const box = $('#impFinals'); if (!box || !r.etapas.length) return;
  box.innerHTML = r.etapas.map(e => {
    if (!e.pendente) {
      const ch = e.jogadores[0];
      return `<div class="card"><div class="row between"><h3>Etapa ${pad(e.etapa)} · final lançada pelo painel</h3>
        <button class="sm danger" data-undo="${e.etapa}">Desfazer final</button></div>
        <p class="small">Campeão: <b>${esc(ch.nome)}</b> (${esc(ch.deck)}). Finalistas: ${e.jogadores.filter(j => j.final).map(j => esc(j.nome) + ' ' + resChip(j.final)).join(', ')}</p></div>`;
    }
    const top = e.jogadores.slice(0, 4).map(j => j.nome);
    return `<div class="card" data-etapa="${e.etapa}" data-fin="${esc(JSON.stringify(top))}"><h3>Etapa ${pad(e.etapa)} · final pendente</h3>
      <p class="small">Finalistas (top 4 do suíço): <b>${top.map(esc).join(', ')}</b>. Escolha o vencedor da final: o sistema calcula a colocação final, os pontos de liga e atualiza o ranking.</p>
      <div class="form"><label>Vencedor da final<select name="out"></select></label>
        <div class="row"><button class="gold" data-launch="${e.etapa}">Lançar final</button></div></div>
</div>`;
  }).join('');
  $$('#impFinals [data-etapa]').forEach(card => {
    const names = JSON.parse(card.dataset.fin);
    $('select[name=out]', card).innerHTML = '<option value="">— escolha —</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')
      + '<option value="E">Empate (o mais bem colocado no suíço fica com o título)</option>';
  });
  $$('[data-launch]').forEach(b => b.onclick = async () => {
    const card = b.closest('[data-etapa]'), etapa = +b.dataset.launch;
    const finalists = JSON.parse(card.dataset.fin), outcome = $('select[name=out]', card).value;
    if (!outcome) return toast('Escolha o vencedor da final.', 'err');
    const res = outcome === 'E' ? 'empate' : 'vitória de ' + outcome;
    if (!confirm(`Lançar a final da Etapa ${pad(etapa)} (${finalists.join(', ')}): ${res}?`)) return;
    try { toast((await api('imported_final', { etapa, finalists, outcome })).msg); importedFinals(); } catch (e) { toast(e.message, 'err'); }
  });
  $$('[data-undo]').forEach(b => b.onclick = async () => {
    if (!confirm(`Desfazer a final da Etapa ${pad(+b.dataset.undo)}? Ela volta a ficar com a final pendente.`)) return;
    try { toast((await api('imported_final_undo', { etapa: +b.dataset.undo })).msg); importedFinals(); } catch (e) { toast(e.message, 'err'); }
  });
}

function swapForm(r) {
  const opts = r.pods.flatMap(p => p.seats.map(s => `<option value="${s.entry_id}">${esc(s.name)} — ${+p.bye ? 'bye' : 'mesa ' + p.table_no}</option>`)).join('');
  return `<details><summary><b>Ajustar mesas</b></summary><form class="form" id="fSwap"><label>Trocar<select name="a">${opts}</select></label><label>com<select name="b">${opts}</select></label><button>Trocar de lugar</button></form>
    <p class="muted small">Só para mesas ainda sem resultado. Os relatos dos jogadores dessas mesas são apagados.</p></details>`;
}

function tabHist(d) {
  if (!d.rounds.length) return '<div class="card empty">Nenhuma rodada ainda.</div>';
  return `<p class="muted small">Rodadas fechadas não podem ser alteradas, porque os resultados já foram usados no pareamento seguinte. Para corrigir a última rodada, use “Reabrir” na aba Rodada atual.</p>` +
    [...d.rounds].reverse().map(r => `<div class="card round"><div class="rh"><h2>${roundName(r)}</h2><span class="muted small">${hhmm(utc(r.started_at))}${r.closed_at ? ' – ' + hhmm(utc(r.closed_at)) : ''}</span></div>
    <div class="pods">${r.pods.map(p => podAdmin(p, r, d)).join('')}</div></div>`).join('');
}

function bindTab(d) {
  const ev = d.event;
  const fa = $('#fAdd');
  if (fa) {
    Promise.all([api('players'), api('decks', undefined, { season: ev.season })]).then(([p, k]) => {
      $('#dlP').innerHTML = p.players.map(n => `<option value="${esc(n)}">`).join('');
      $('#dlD').innerHTML = k.decks.map(n => `<option value="${esc(n)}">`).join('');
    }).catch(() => {});
    fa.onsubmit = act(async e => { e.preventDefault(); const fd = new FormData(fa); await api('entry_add', { event_id: ev.id, name: fd.get('name'), deck: fd.get('deck'), checked_in: fd.has('checked_in') ? 1 : 0 }); }, 'Jogador adicionado.');
  }
  $('#bAll')?.addEventListener('click', act(() => api('checkin_all', { event_id: ev.id }), 'Todos marcados como presentes.'));
  $$('input[data-k]').forEach(c => c.onchange = act(() => api('entry_update', { id: +c.dataset.e, [c.dataset.k]: c.checked ? 1 : 0 })));
  $$('input[data-deck]').forEach(i => i.onchange = act(() => {
    if (d.banned.map(x => x.toLowerCase()).includes(i.value.trim().toLowerCase())) toast(`Atenção: ${i.value} está banido por performance.`, 'warn');
    return api('entry_update', { id: +i.dataset.deck, deck: i.value });
  }));
  $$('[data-del]').forEach(b => b.onclick = act(() => confirm('Excluir esta inscrição?') && api('entry_delete', { id: +b.dataset.del })));
  $$('select[data-pod]').forEach(s => s.onchange = act(() => api('pod_result', { pod_id: +s.dataset.pod, outcome: s.value })));
  const cur = d.rounds[d.rounds.length - 1];
  $('#bGen')?.addEventListener('click', act(() => api('round_generate', { event_id: ev.id }), 'Rodada gerada.'));
  $('#bFinal')?.addEventListener('click', act(() => api('final_generate', { event_id: ev.id }), 'Mesa final gerada.'));
  $('#bPublish')?.addEventListener('click', async () => {
    if (!confirm('Publicar o resultado do suíço no ranking como “final pendente”?')) return;
    try { toast((await api('publish_swiss', { event_id: ev.id })).msg); } catch (e) { toast(e.message, 'err'); }
  });
  $('#bCloseR')?.addEventListener('click', act(() => api('round_close', { round_id: cur.id }), 'Rodada fechada.'));
  $('#bReopenR')?.addEventListener('click', act(() => api('round_reopen', { round_id: cur.id }), 'Rodada reaberta.'));
  $('#bDelR')?.addEventListener('click', act(() => confirm(`Desfazer a ${roundName(cur).toLowerCase()}? Mesas e resultados dela serão apagados.`) && api('round_delete', { round_id: cur.id }), 'Rodada desfeita.'));
  const fs = $('#fSwap');
  if (fs) fs.onsubmit = act(e => { e.preventDefault(); const fd = new FormData(fs); return api('swap', { round_id: cur.id, a: +fd.get('a'), b: +fd.get('b') }); }, 'Jogadores trocados.');
}

async function closePreview() {
  const ev = st.data.event;
  let fp;
  try { fp = await api('close_preview', undefined, { event_id: ev.id }); } catch (e) { return toast(e.message, 'err'); }
  const f = $('#dlgForm');
  f.innerHTML = `<h2>Fechar evento</h2>
    ${+ev.test ? '<div class="msg warn">Evento de teste: nada vai para o ranking.</div>' : !ev.etapa ? '<div class="msg err">Defina a etapa nas configurações antes de fechar.</div>' : `<p>Resultado que vai para o ranking anual (Etapa ${pad(ev.etapa)}). Se a etapa já existir no histórico, ela é substituída.</p>`}
    ${fp.note ? `<div class="msg warn">${esc(fp.note)}</div>` : ''}
    <div class="scroll"><table><thead><tr><th class="r">#</th><th>Jogador</th><th>Deck</th><th class="r">Pts</th><th class="c">V-E-D</th><th class="r">Liga</th></tr></thead><tbody>
    ${fp.rows.map(r => `<tr class="${r.pos <= 4 ? 'top4' : ''}"><td class="r num">${r.pos}º</td><td>${esc(r.name)}</td><td class="muted">${esc(r.deck)}</td><td class="r num">${r.pts}</td><td class="c num">${r.v}-${r.e}-${r.d}</td><td class="r num"><b>+${r.ap}</b></td></tr>`).join('')}
    </tbody></table></div>
    <div class="row"><button class="gold" value="ok" ${!ev.etapa && !+ev.test ? 'disabled' : ''}>Confirmar e fechar</button><button value="cancel" formnovalidate>Cancelar</button></div>`;
  f.onsubmit = async e => {
    if (e.submitter?.value !== 'ok') return;
    e.preventDefault();
    try { await api('event_close', { event_id: ev.id }); $('#dlg').close(); toast('Evento fechado. Ranking atualizado.'); loadEvent(); } catch (err) { toast(err.message, 'err'); }
  };
  $('#dlg').showModal();
}
