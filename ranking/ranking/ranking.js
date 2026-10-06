'use strict';
// Página do ranking da Liga Precon BH. Os dados vêm do sistema (liga/api.php) e o
// comparativo de 2025 de ranking/dados-2025.json. Sem estilos/scripts dentro do HTML:
// o servidor só permite arquivos próprios (CSP), por isso atributos de estilo usam data-style.
document.documentElement.classList.add('js');

// data-style="..." vira estilo de verdade via CSSOM (style="..." no HTML é bloqueado pela CSP)
function applyDataStyles(root) {
  if (root.nodeType !== 1) return;
  if (root.hasAttribute('data-style')) root.style.cssText = root.getAttribute('data-style');
  root.querySelectorAll('[data-style]').forEach(el => { el.style.cssText = el.getAttribute('data-style'); });
}
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(applyDataStyles))).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => applyDataStyles(document.body));

// Artes dos comandantes campeões de cada etapa (ranking/cmd/etN.jpg)
const CMD = {"1": {"n": "Ashling, the Limitless", "img": "ranking/cmd/et1.jpg"}, "2": {"n": "Stella Lee, Wild Card", "img": "ranking/cmd/et2.jpg"}, "3": {"n": "Ixhel, Scion of Atraxa", "img": "ranking/cmd/et3.jpg"}, "4": {"n": "Quintorius, History Chaser", "img": "ranking/cmd/et4.jpg"}, "5": {"n": "Zimone, Infinite Analyst", "img": "ranking/cmd/et5.jpg"}, "6": {"n": "Sidar Jabari of Zhalfir", "img": "ranking/cmd/et6.jpg"}, "7": {"n": "Aesi, Tyrant of Gyre Strait", "img": "ranking/cmd/et7.jpg"}, "8": {"n": "Valgavoth, Harrower of Souls", "img": "ranking/cmd/et8.jpg"}};

async function loadData() {
  const [season, y25] = await Promise.all([
    fetch('liga/api.php?a=season', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('ranking'); return r.json(); }),
    fetch('ranking/dados-2025.json').then(r => r.json()),
  ]);
  return { D: { pl: season.pl, dk: season.dk, reg: season.reg }, Y: y25 };
}

(async () => {
  let data;
  try { data = await loadData(); }
  catch (e) {
    const s = document.getElementById('heroSub');
    if (s) s.textContent = 'Não foi possível carregar os dados do ranking agora. Tente recarregar a página em instantes.';
    return;
  }
  main(data.D, data.Y);
})();

function main(D, Y) {

const $=s=>document.querySelector(s);
const fmt=(n,d=0)=>n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const brl=n=>'R$ '+fmt(n,2);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=e=>String(e).padStart(2,'0');

// Tooltip (mouse e toque)
const tip=$('#tip');
function showTip(e,h){tip.innerHTML=h;tip.hidden=false;const r=tip.getBoundingClientRect();
 const x=Math.max(8,Math.min(e.clientX+14,innerWidth-r.width-8));let y=e.clientY+14;if(y+r.height>innerHeight-8)y=e.clientY-r.height-12;
 tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){tip.hidden=true}
addEventListener('scroll',hideTip,{passive:true});
function bindTips(el){el.querySelectorAll('[data-t]').forEach(r=>{r.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')showTip(e,r.dataset.t)});r.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hideTip()});r.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')showTip(e,r.dataset.t)})})}
document.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'&&!e.target.closest('[data-t]'))hideTip()});

// Gráficos desenhados na largura real do contêiner, para o texto não encolher no celular
const charts=[];
function chart(el,draw,after){let w0=0,t;const run=()=>{const W=Math.max(280,Math.round(el.clientWidth));w0=W;el.innerHTML=draw(W);bindTips(el);after&&after(el)};charts.push(run);run();
 if(window.ResizeObserver)new ResizeObserver(()=>{if(Math.abs(Math.round(el.clientWidth)-w0)<2)return;clearTimeout(t);t=setTimeout(run,120)}).observe(el)}

// Tabelas ordenáveis
function thead(cols,s){return '<thead><tr>'+cols.map(([k,l,c,sortable=true])=>`<th class="${c||''}"${sortable?` tabindex="0" data-k="${k}" aria-sort="${s.k===k?(s.dir>0?'ascending':'descending'):'none'}"`:''}>${l}</th>`).join('')+'</tr></thead>'}
function sortRows(rows,s){return rows.sort((a,b)=>{const va=a[s.k],vb=b[s.k];return (typeof va==='string'?va.localeCompare(vb,'pt'):va-vb)*s.dir})}
function bindSort(tbl,s,asc,render){tbl.querySelectorAll('th[data-k]').forEach(th=>{const go=()=>{const k=th.dataset.k;if(s.k===k)s.dir=-s.dir;else{s.k=k;s.dir=asc.includes(k)?1:-1}render()};th.onclick=go;th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}})}
const vedBar=(v,e,d)=>{const t=v+e+d||1;return `<span class="ved" title="${v}V ${e}E ${d}D"><i data-style="width:${v/t*100}%;background:var(--good)"></i><i data-style="width:${e/t*100}%;background:var(--warn)"></i><i data-style="width:${d/t*100}%;background:var(--neutral)"></i></span>`};
const medal=p=>p<=3?`<span class="medal ${p===2?'s':p===3?'b':''}">${p}</span>`:`${p}º`;
const profUrl=n=>'liga/#j/'+encodeURIComponent(n);
const pLink=n=>`<a class="lnk" href="${profUrl(n)}">${esc(n)}</a>`;
const deckUrl=n=>'liga/#d/'+encodeURIComponent(n);
const dLink=n=>`<a class="lnk" href="${deckUrl(n)}">${esc(n)}</a>`;

// ===== Dados derivados
const MES=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESL=['','janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const CAL=[
 {n:'Etapa 01',d:'2026-01-31',et:1},{n:'Etapa 02',d:'2026-02-21',et:2},{n:'Etapa 03',d:'2026-03-21',et:3},{n:'Etapa 04',d:'2026-04-26',et:4},
 {n:'Etapa 05',d:'2026-05-16',et:5},{n:'Etapa 06',d:'2026-06-21',et:6},{n:'Etapa 07',d:'2026-07-18',et:7},{n:'Etapa 08',d:'2026-08-15',et:8},
 {n:'Etapa 09',d:'2026-10-03',et:9,form:'https://forms.gle/zfwNaPDtPeEpSmMD8',emp:'https://www.planarforge.com/EMP/convite/evento/4316/7iT0vVoa'},
 {n:'Etapa 10',d:'2026-10-31',et:10,obs:'última etapa prevista'},
 {n:'Data reservada',d:'2026-11-07'},{n:'Data reservada',d:'2026-12-12'}
].map(c=>({...c,t:new Date(c.d+'T10:00:00-03:00')}));
const etDate=Object.fromEntries(CAL.filter(c=>c.et).map(c=>[c.et,c]));
const dm=t=>`${pad(t.getDate())}/${pad(t.getMonth()+1)}`;

const byEt={};D.reg.forEach(r=>(byEt[r.et]??=[]).push(r));
Object.values(byEt).forEach(a=>a.sort((x,y)=>x.pos-y.pos));
const ets=Object.keys(byEt).map(Number).sort((a,b)=>a-b);
const lastEt=ets[ets.length-1];
// Etapa com final ainda não disputada: sem pontos de liga e sem campeão
const pend=new Set(ets.filter(e=>byEt[e].some(r=>r.ap==null)));
const insc=D.reg.length,fee=30;
const potAnual=insc*fee*.7*.25;
const decksUsed=new Set(D.reg.map(r=>r.deck)).size;
const regBy=k=>{const m={};D.reg.forEach(r=>(m[k(r)]??=[]).push(r));return m};
const regPl=regBy(r=>r.j.toLowerCase()), regDk=regBy(r=>r.deck);
const plBy=Object.fromEntries(D.pl.map(p=>[p.n.toLowerCase(),p]));
const dkBy=Object.fromEntries(D.dk.map(d=>[d.n,d]));
const PRIZE=[30,15,12,10,8,7,6,5,4,3];
const prizeOf=rk=>rk<=10?potAnual*PRIZE[rk-1]/100:0;

// ===== Hero e próxima etapa
const now=new Date();
const nextEv=CAL.find(c=>c.t>now&&c.et);
$('#heroSub').textContent=`Temporada até a Etapa ${pad(lastEt)} (${MESL[etDate[lastEt].t.getMonth()+1]}${pend.has(lastEt)?', final ainda pendente':''}). Ranking anual, resultados de cada etapa, desempenho de decks e radar de banimento.`;
if(nextEv){const days=Math.ceil((nextEv.t-now)/864e5);
 $('#next').innerHTML=`<span class="eyebrow">Próxima etapa</span><span class="d">${esc(nextEv.n)}</span>
  <span class="w">${DIAS[nextEv.t.getDay()]}, ${dm(nextEv.t)} · 10:00 · Vault of Cards</span>
  <span class="cd">${days>1?`faltam ${days} dias`:days===1?'é amanhã':'é hoje'}</span>
  ${nextEv.form||nextEv.emp?`<div class="btns">${nextEv.form?`<a class="btn pri" href="${nextEv.form}" target="_blank" rel="noopener">Inscrever-se ↗</a>`:''}${nextEv.emp?`<a class="btn" href="${nextEv.emp}" target="_blank" rel="noopener">Evento no EMP ↗</a>`:''}</div>`:''}`;
}else $('#next').hidden=true;

// Navegação: destaca a seção visível sem mexer na rolagem da página
(()=>{const bar=$('nav.tabs .in'),links=[...bar.querySelectorAll('a[href^="#"]')],secs=links.map(a=>$(a.getAttribute('href'))).filter(Boolean);
 let cur=null,target=null,idle;
 const setActive=id=>{if(id===cur)return;cur=id;links.forEach(a=>{const on=a.getAttribute('href')==='#'+id;a.setAttribute('aria-current',String(on));
  if(on){const r=a.getBoundingClientRect(),n=bar.getBoundingClientRect();if(r.left<n.left||r.right>n.right)bar.scrollBy({left:r.left-n.left-12,behavior:'smooth'})}})};
 const compute=()=>{if(target)return;const off=$('nav.tabs').offsetHeight+90;let id=secs[0].id;
  for(const s of secs)if(s.getBoundingClientRect().top<=off)id=s.id;
  if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)id=secs[secs.length-1].id;setActive(id)};
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 links.forEach(a=>a.addEventListener('click',ev=>{ev.preventDefault();target=a.getAttribute('href').slice(1);cur=null;setActive(target);
  const el=$('#'+target),y=Math.min(el.getBoundingClientRect().top+scrollY-$('nav.tabs').offsetHeight-6,document.documentElement.scrollHeight-innerHeight);
  scrollTo({top:Math.max(0,y),behavior:reduce?'auto':'smooth'});history.replaceState(null,'','#'+target);clearTimeout(idle);idle=setTimeout(()=>{target=null},1500)}));
 let raf=0;addEventListener('scroll',()=>{if(target){clearTimeout(idle);idle=setTimeout(()=>{target=null;compute()},180);return}
  if(!raf)raf=requestAnimationFrame(()=>{raf=0;compute()})},{passive:true});
 compute()})();

// ===== KPIs
$('#kpis').innerHTML=[
 [`${ets.length}/10`,'etapas disputadas'],
 [fmt(insc),'inscrições no ano'],
 [fmt(D.pl.length),'jogadores diferentes'],
 [fmt(decksUsed),'decks diferentes'],
 [fmt(insc/ets.length,1),'média por etapa'],
 [brl(potAnual),'pote anual estimado','gold']
].map(([b,s,c])=>`<div class="kpi ${c||''}"><b>${b}</b><span>${s}</span></div>`).join('');

// ===== Corrida pelo título
chart($('#race'),W=>{const narrow=W<600,H=narrow?260:300,m={l:34,r:narrow?92:120,t:14,b:30},iw=W-m.l-m.r,ih=H-m.t-m.b;
 const top=D.pl.slice(0,8);
 const series=top.map(p=>{let acc=0;const rs=regPl[p.n.toLowerCase()]||[];return {p,pts:ets.map(e=>{const r=rs.find(r=>r.et===e);acc+=r?r.ap:0;return acc})}});
 const ymax=Math.ceil(Math.max(...series.map(s=>s.pts.at(-1)))/4)*4||4;
 const x=i=>m.l+i/(ets.length-1)*iw,y=v=>m.t+ih-v/ymax*ih;
 const COL=['var(--gold)','var(--accent)','var(--bar)'];
 let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Pontos acumulados por etapa do top 8">`;
 for(let v=0;v<=ymax;v+=4)s+=`<line x1="${m.l}" x2="${m.l+iw}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${m.l-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
 ets.forEach((e,i)=>s+=`<text x="${x(i)}" y="${H-10}" text-anchor="middle">${narrow?pad(e):MES[etDate[e].t.getMonth()+1]}</text>`);
 const used=[];
 [...series].reverse().forEach((sr,ri)=>{const i=series.length-1-ri;const c=i<3?COL[i]:'var(--neutral)',w=i<3?2.5:1.5;
  s+=`<polyline class="dl" data-style="--i:${i}" pathLength="1" points="${sr.pts.map((v,j)=>`${x(j)},${y(v)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" opacity="${i<3?1:.8}"/>`;
  sr.pts.forEach((v,j)=>s+=`<circle class="fi" cx="${x(j)}" cy="${y(v)}" r="${i<3?3.5:2.5}" fill="${c}" stroke="var(--surface)" stroke-width="1.5"/>`);
  s+=`<polyline points="${sr.pts.map((v,j)=>`${x(j)},${y(v)}`).join(' ')}" fill="none" stroke="transparent" stroke-width="14" data-t="<b>${sr.p.rk}º ${esc(sr.p.n)}</b><br>${sr.pts.map((v,j)=>`${pad(ets[j])}: ${v}`).join(' · ')}"/>`});
 series.forEach((sr,i)=>{let ly=y(sr.pts.at(-1))+4;while(used.some(u=>Math.abs(u-ly)<13))ly+=13;used.push(ly);
  s+=`<text x="${m.l+iw+8}" y="${ly}" data-style="fill:${i<3?'var(--ink)':'var(--ink-2)'};font-family:var(--f-body);font-weight:${i<3?600:400}">${sr.p.rk}. ${esc(sr.p.n.length>12&&narrow?sr.p.n.slice(0,11)+'…':sr.p.n)}</text>`});
 return s+'</svg>'});

// ===== Replay da corrida
const replay=(()=>{const box=$('#rbars'),N=10,rowH=34,last=ets.length-1,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const cum=D.pl.map(p=>{let a=0;const rs=regPl[p.n.toLowerCase()]||[];return {p,pts:ets.map(e=>{const r=rs.find(r=>r.et===e);a+=r?r.ap:0;return a})}});
 const at=k=>[...cum].sort((a,b)=>b.pts[k]-a.pts[k]||a.p.rk-b.p.rk);
 const seen=new Set();ets.forEach((_,k)=>at(k).slice(0,N).forEach(c=>seen.add(c)));
 const mx=Math.max(...cum.map(c=>c.pts[last]),1);
 box.style.setProperty('--rows',N);
 box.innerHTML=[...seen].map(c=>`<div class="rbar" data-n="${esc(c.p.n)}"><span class="p"></span><span class="nm">${pLink(c.p.n)}<span class="mv"></span></span><span class="tr"><span class="b"></span><span class="v"></span></span></div>`).join('');
 const el=new Map([...seen].map((c,i)=>[c,box.children[i]]));
 const scrub=$('#rScrub'),btn=$('#rPlay');scrub.max=last;let k=last,timer=null;
 function draw(step){k=step;const st=at(k),prev=k?at(k-1):null;
  st.forEach((c,i)=>{const d=el.get(c);if(!d)return;const top=i<N;
   d.style.transform=`translateY(${(top?i:N)*rowH}px)`;d.style.opacity=top?1:0;d.setAttribute('aria-hidden',String(!top));d.className='rbar'+(top&&i<3?' r'+(i+1):'');
   d.querySelector('.p').textContent=(i+1)+'º';const w=c.pts[k]/mx*86;d.querySelector('.b').style.width=w+'%';const v=d.querySelector('.v');v.style.left=w+'%';v.textContent=c.pts[k];
   let mv='';if(prev&&top){const j=prev.indexOf(c);if(j>i)mv=`<span class="up">▲${j-i}</span>`;else if(j<i)mv=`<span class="dn">▼${i-j}</span>`}d.querySelector('.mv').innerHTML=mv});
  scrub.value=k;$('#rStep').textContent=`Após a Etapa ${pad(ets[k])} · ${MES[etDate[ets[k]].t.getMonth()+1]}`}
 const label=()=>{btn.textContent=timer?'❚❚ Pausar':k===last?'↺ Reproduzir':'▶ Continuar'};
 const stop=()=>{clearInterval(timer);timer=null;label()};
 function play(){if(timer)return stop();if(k===last)draw(0);timer=setInterval(()=>{if(k>=last)return stop();draw(k+1);if(k>=last)stop()},reduce?900:1300);label()}
 btn.onclick=play;scrub.oninput=()=>{if(timer)stop();draw(+scrub.value);label()};
 draw(last);btn.textContent='▶ Reproduzir';
 return {auto(){if(!timer&&!reduce){draw(0);label();setTimeout(()=>{if(!timer&&k===0)play()},600)}}}})();
(()=>{const r=$('#vReplay'),l=$('#vLines');const set=lines=>{r.setAttribute('aria-pressed',String(!lines));l.setAttribute('aria-pressed',String(lines));$('#replayP').hidden=lines;$('#linesP').hidden=!lines;
  $('#raceSub').textContent=lines?'Pontos de ranking acumulados por etapa, top 8 atual':'Top 10 depois de cada etapa, em pontos de ranking acumulados';
  if(lines){const c=$('#linesP').closest('.card');c.classList.remove('done');charts[0]();setTimeout(()=>c.classList.add('done'),2400)}};
 r.onclick=()=>set(false);l.onclick=()=>set(true)})();

// ===== Ranking
const rS={k:'rk',dir:1};
function renderRank(){const q=$('#q').value.trim().toLowerCase();
 const cols=[['rk','#','r'],['n','Jogador'],['pts','Pontos','r'],['et','Etapas','r hm'],['v','V-E-D','r'],['wr','Win rate','r'],['tb1','TB1 méd.','r hm'],['totN','Desempate','r hm']];
 let rows=D.pl.filter(p=>p.n.toLowerCase().includes(q)).map(p=>({...p,et:(regPl[p.n.toLowerCase()]||[]).length,totN:parseFloat(p.tot.replace(',','.')),prize:prizeOf(p.rk)}));
 sortRows(rows,rS);
 const t=$('#rank');
 t.innerHTML=thead(cols,rS)+'<tbody>'+(rows.length?rows.map(p=>`<tr class="${p.rk<=10?'top':''}"><td class="r num">${medal(p.rk)}</td><td>${pLink(p.n)}</td><td class="r num"><b>${fmt(p.pts)}</b></td><td class="r num hm">${p.et}</td><td class="r"><span data-style="display:inline-flex;gap:8px;align-items:center;justify-content:flex-end"><span class="num">${p.v}-${p.e}-${p.d}</span><span class="hm">${vedBar(p.v,p.e,p.d)}</span></span></td><td class="r num">${fmt(p.wr,1)}%</td><td class="r num hm">${fmt(p.tb1,2)}</td><td class="r num hm muted">${p.tot}</td></tr>`).join(''):`<tr><td colspan="8" class="muted">Nenhum jogador encontrado.</td></tr>`)+'</tbody>';
 bindSort(t,rS,['rk','n'],renderRank)}
$('#q').addEventListener('input',renderRank);renderRank();
$('#potfoot').innerHTML=`Linhas em dourado: top 10, que divide o pote anual. Estimativa: ${insc} inscrições × R$ 30 × 70% × 25% = <b>${brl(potAnual)}</b>, repartido em 30%, 15%, 12%, 10%, 8%, 7%, 6%, 5%, 4% e 3%. O valor cresce a cada etapa.`;

// ===== Etapas
let selEt=lastEt;
chart($('#part'),W=>{const narrow=W<600,H=narrow?200:230,m={l:28,r:narrow?8:70,t:22,b:28},iw=W-m.l-m.r,ih=H-m.t-m.b;
 const max=Math.max(28,Math.max(...ets.map(e=>byEt[e].length))+2),bw=iw/ets.length;const y=v=>m.t+ih-v/max*ih;
 let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Participantes por etapa">`;
 [0,8,16,24].forEach(v=>s+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${m.l-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`);
 [[16.5,'top 8 ↑'],[24.5,'top 12 ↑']].forEach(([v,l])=>{s+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--gold)" stroke-dasharray="3 4" opacity=".8"/>`;if(!narrow)s+=`<text x="${W-m.r+6}" y="${y(v)+4}" data-style="fill:var(--gold);font-size:11px">${l}</text>`});
 ets.forEach((e,i)=>{const n=byEt[e].length,x=m.l+i*bw+bw*.18,w=bw*.64,top=y(n);const on=e===selEt;
  const t=`<b>Etapa ${pad(e)} · ${dm(etDate[e].t)}</b><br>${n} jogadores<br>Pote mensal ≈ ${brl(n*fee*.7*.75)}<br>${pend.has(e)?'Final pendente':'Campeão: '+esc(byEt[e][0].j)}`;
  s+=`<path class="gb" data-style="--i:${i}" d="M${x},${m.t+ih}V${top+4}q0,-4 4,-4h${w-8}q4,0 4,4V${m.t+ih}Z" fill="${on?'var(--accent)':'var(--bar)'}" opacity="${on?1:.75}"/>`;
  s+=`<text x="${x+w/2}" y="${top-6}" text-anchor="middle" data-style="fill:var(--ink);font-weight:600">${n}</text>`;
  s+=`<text x="${x+w/2}" y="${H-9}" text-anchor="middle" data-style="${on?'fill:var(--accent);font-weight:600':''}">${narrow?pad(e):MES[etDate[e].t.getMonth()+1]}</text>`;
  s+=`<rect x="${m.l+i*bw}" y="${m.t}" width="${bw}" height="${ih+m.b}" fill="transparent" data-style="cursor:pointer" data-et="${e}" data-t="${t}"/>`});
 return s+'</svg>'},el=>el.querySelectorAll('[data-et]').forEach(r=>r.addEventListener('click',()=>selectEt(+r.dataset.et))));
// Comandantes dos decks campeões (arte recortada das cartas enviadas pela organização)
const MANA=["linear-gradient(160deg,#fbf0c4,#d9ae4c 55%,#6b4f12)","linear-gradient(160deg,#9fdcff,#2a6cc4 55%,#0c214d)","linear-gradient(160deg,#a598ad,#43364a 55%,#120d14)","linear-gradient(160deg,#ffb886,#c8262d 55%,#4a070a)","linear-gradient(160deg,#c3e8a8,#2f8a52 55%,#0f2e1c)"];
const spark='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 L13.6 10.4 L22.5 12 L13.6 13.6 L12 22.5 L10.4 13.6 L1.5 12 L10.4 10.4Z"/></svg>';
function renderChamps(){const box=$('#champs');
 box.innerHTML=ets.map((e,i)=>{const rs=byEt[e],c=rs[0],t=etDate[e].t;
  return `<div class="mcard" tabindex="0" role="button" aria-pressed="false" aria-current="${e===selEt}" aria-label="Etapa ${pad(e)}: ${pend.has(e)?'final pendente, líder do suíço '+esc(c.j):'campeão '+esc(c.j)+' com '+esc(c.deck)}${CMD[e]?` (${esc(CMD[e].n)})`:``}. Clique para ver o pódio." data-et="${e}" data-style="--art:${MANA[i%5]}"><div class="ci">
   <div class="face front">${pend.has(e)?'<div class="mc-bar"><span>Final pendente</span><i>⏳</i></div>':`<div class="mc-bar"><span>${esc(c.j)}</span><i>♛</i></div>`}
    ${CMD[e]?`<div class="mc-art has-img"><img src="${CMD[e].img}" alt="${esc(CMD[e].n)}" decoding="async"><span class="tag">${MES[t.getMonth()+1].toUpperCase()} · ETAPA ${pad(e)}</span><span class="cap">${esc(CMD[e].n)}</span></div>`:`<div class="mc-art">${spark}<div class="big">${MES[t.getMonth()+1].toUpperCase()}<small>ETAPA ${pad(e)}</small></div></div>`}
    <div class="mc-bar mc-type"><span>${pend.has(e)?'Finalistas':'Campeão'} · ${rs.length} jog.</span></div>
    <div class="mc-text">${pend.has(e)?`<span class="dk">${rs.slice(0,4).map(r=>esc(r.j)).join(', ')}</span><span class="st">mesa final a disputar</span>`:`<span class="dk">${esc(c.deck)}</span><span class="st">${c.v}-${c.e}-${c.d} · +${c.ap} pts</span>`}</div>
    <div class="mc-foot"><span>${dm(t)}/${t.getFullYear()}</span><span>Vault · BH</span></div><span class="foil"></span></div>
   <div class="face back"><h4>${pend.has(e)?'Top 4 do suíço':'Pódio'} · Etapa ${pad(e)}</h4><ol>${rs.slice(0,4).map(r=>`<li><b>${r.pos}º</b><span>${esc(r.j)}<small>${esc(r.deck)}</small></span></li>`).join('')}</ol>
    <button class="go" type="button" tabindex="-1">Resultado completo ↓</button><span class="hint">clique para virar</span><span class="foil"></span></div>
  </div></div>`}).join('');
 box.querySelectorAll('.mcard').forEach(card=>{const e=+card.dataset.et,go=card.querySelector('.go');
  const flip=()=>{const on=card.classList.toggle('flip');card.setAttribute('aria-pressed',String(on));go.tabIndex=on?0:-1};
  card.addEventListener('click',ev=>{if(ev.target.closest('.go'))return;flip()});
  card.addEventListener('keydown',ev=>{if(ev.target!==card)return;if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();flip()}});
  go.addEventListener('click',ev=>{ev.stopPropagation();selectEt(e);$('#etTable').closest('.card').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})});
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  card.addEventListener('pointermove',ev=>{if(ev.pointerType!=='mouse')return;const r=card.getBoundingClientRect(),px=(ev.clientX-r.left)/r.width,py=(ev.clientY-r.top)/r.height;
   card.classList.add('tilting');card.style.setProperty('--ry',((px-.5)*22).toFixed(1)+'deg');card.style.setProperty('--rx',((.5-py)*16).toFixed(1)+'deg');
   card.style.setProperty('--mx',(px*100).toFixed(0)+'%');card.style.setProperty('--my',(py*100).toFixed(0)+'%')});
  card.addEventListener('pointerleave',()=>{card.classList.remove('tilting');card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg')})})}
function markChamp(){$('#champs').querySelectorAll('.mcard').forEach(c=>c.setAttribute('aria-current',String(+c.dataset.et===selEt)))}
function renderEt(){const rows=byEt[selEt],c=etDate[selEt];const n=rows.length,cut=n<=16?4:n<=24?8:12;
 $('#etTitle').textContent=`Etapa ${pad(selEt)} · ${DIAS[c.t.getDay()]}, ${dm(c.t)}`;
 $('#etSub').textContent=`${n} jogadores · premiação para o top ${cut} · pote mensal ≈ ${brl(n*fee*.7*.75)}${pend.has(selEt)?' · mesa final ainda não disputada: ordem do suíço, sem pontos de liga':''}`;
 $('#etTable').innerHTML=thead([['pos','#','r',false],['j','Jogador','',false],['deck','Deck','',false],['ved','V-E-D','r',false],['emp','Pts evento','r hm',false],['ap','Pts liga','r',false]],{})+'<tbody>'+
  rows.map(r=>`<tr class="${r.pos<=cut?'top':''}"><td class="r num">${medal(r.pos)}</td><td>${pLink(r.j)}</td><td>${dLink(r.deck)}</td><td class="r num">${r.v}-${r.e}-${r.d}</td><td class="r num hm">${r.emp}</td><td class="r num">${r.ap==null?'<span class="muted">—</span>':`<b>+${r.ap}</b>`}</td></tr>`).join('')+'</tbody>'}
function selectEt(e){selEt=e;charts[1]();markChamp();renderEt()}
renderChamps();renderEt();

// ===== Decks
let dAll=false;const dS={k:'p',dir:-1};
function renderDecks(){const q=$('#qd').value.trim().toLowerCase();
 let rows=D.dk.filter(d=>(dAll||d.p>=10)&&d.n.toLowerCase().includes(q)).map(d=>({...d,pil:new Set((regDk[d.n]||[]).map(r=>r.j.toLowerCase())).size}));
 sortRows(rows,dS);
 const cols=[['n','Deck'],['p','Partidas','r'],['v','V','r hm'],['e','E','r hm'],['d','D','r hm'],['ved','V-E-D','r',false],['wr','Win rate','r'],['pil','Pilotos','r hm']];
 const t=$('#decksT');
 t.innerHTML=thead(cols,dS)+'<tbody>'+(rows.length?rows.map(d=>`<tr><td>${dLink(d.n)}</td><td class="r num">${d.p}</td><td class="r num hm">${d.v}</td><td class="r num hm">${d.e}</td><td class="r num hm">${d.d}</td><td class="r">${vedBar(d.v,d.e,d.d)}</td><td class="r num" data-style="${d.wr>33.33?'color:var(--crit);font-weight:600':''}">${fmt(d.wr,1)}%</td><td class="r num hm">${d.pil}</td></tr>`).join(''):`<tr><td colspan="8" class="muted">Nenhum deck encontrado.</td></tr>`)+'</tbody>';
 $('#dCount').textContent=`${rows.length} de ${D.dk.length} decks`;
 bindSort(t,dS,['n'],renderDecks)}
const setF=all=>{dAll=all;$('#f10').setAttribute('aria-pressed',String(!all));$('#fall').setAttribute('aria-pressed',String(all));renderDecks()};
$('#f10').onclick=()=>setF(false);$('#fall').onclick=()=>setF(true);$('#qd').addEventListener('input',renderDecks);
renderDecks();

// ===== Radar de banimento
const RCOL={Banido:'var(--crit)',Alto:'var(--crit)','Médio':'var(--warn)',Baixo:'var(--neutral)'};
chart($('#scatter'),W=>{const narrow=W<640,H=narrow?300:360,m={l:40,r:narrow?12:130,t:18,b:40},iw=W-m.l-m.r,ih=H-m.t-m.b;
 const xmax=Math.max(30,Math.ceil((Math.max(...D.dk.map(d=>d.p))+2)/5)*5),ymax=65;const x=v=>m.l+v/xmax*iw,y=v=>m.t+ih-v/ymax*ih;
 let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Partidas jogadas versus percentual de vitórias por deck">`;
 s+=`<rect x="${x(24)}" y="${y(ymax)}" width="${x(xmax)-x(24)}" height="${y(33.33)-y(ymax)}" fill="var(--crit)" opacity=".08"/>`;
 [0,10,20,30,40,50,60].forEach(v=>s+=`<line x1="${m.l}" x2="${m.l+iw}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${m.l-6}" y="${y(v)+4}" text-anchor="end">${v}%</text>`);
 for(let v=0;v<=xmax;v+=narrow?10:5)s+=`<text x="${x(v)}" y="${H-20}" text-anchor="middle">${v}</text>`;
 s+=`<text x="${m.l+iw/2}" y="${H-4}" text-anchor="middle">partidas jogadas</text>`;
 s+=`<line x1="${m.l}" x2="${m.l+iw}" y1="${y(33.33)}" y2="${y(33.33)}" stroke="var(--crit)" stroke-dasharray="4 4"/>`;
 s+=narrow?`<text x="${m.l+4}" y="${y(33.33)-5}" data-style="fill:var(--crit)">33,33%</text>`:`<text x="${m.l+iw+6}" y="${y(33.33)+4}" data-style="fill:var(--crit)">33,33% win rate</text>`;
 s+=`<line x1="${x(24)}" x2="${x(24)}" y1="${m.t}" y2="${m.t+ih}" stroke="var(--crit)" stroke-dasharray="4 4"/><text x="${narrow?x(24)-4:x(24)+5}" y="${m.t+12}" text-anchor="${narrow?'end':'start'}" data-style="fill:var(--crit)">${narrow?'24 part.':'24 partidas'}</text>`;
 s+=narrow?`<text x="${x(xmax)-3}" y="${y(60)}" text-anchor="end" data-style="fill:var(--crit);font-weight:600">ban</text>`:`<text x="${(x(24)+x(xmax))/2}" y="${y(56)}" text-anchor="middle" data-style="fill:var(--crit);font-weight:600">zona de ban</text>`;
 let pi=0;[...D.dk].sort((a,b)=>(b.risk==='Baixo')-(a.risk==='Baixo')).forEach(d=>{const r=(narrow?3:4)+Math.sqrt(d.v)*(narrow?1.7:2.2);
  s+=`<circle class="pp" data-style="--i:${pi++}" cx="${x(d.p)}" cy="${y(d.wr)}" r="${r}" fill="${RCOL[d.risk]}" fill-opacity="${d.risk==='Baixo'?.5:.9}" stroke="var(--surface)" stroke-width="1.5" data-style="cursor:pointer" data-deck="${esc(d.n)}" data-t="<b>${esc(d.n)}</b><br>${d.p} partidas · ${d.v}V ${d.e}E ${d.d}D<br>Win rate ${fmt(d.wr,2)}%"/>`});
 const lab=D.dk.filter(d=>narrow?d.risk==='Alto':(d.risk!=='Baixo'||d.p>=24));const used=[];
 lab.sort((a,b)=>b.wr-a.wr).forEach(d=>{let ly=y(d.wr)+4;let lx=x(d.p)+9;const anchor=lx+110>W?'end':'start';if(anchor==='end')lx=x(d.p)-9;
  while(used.some(u=>Math.abs(u.x-lx)<110&&Math.abs(u.y-ly)<13))ly+=13;used.push({x:lx,y:ly});
  s+=`<text x="${lx}" y="${ly}" text-anchor="${anchor}" data-style="fill:var(--ink);font-family:var(--f-body)">${esc(d.n)}</text>`});
 return s+'</svg>'},el=>el.querySelectorAll('circle[data-deck]').forEach(c=>c.addEventListener('click',()=>openDeck(c.dataset.deck))));
(()=>{const need=(d,strict)=>{for(let x=0;x<=3;x++){const P=d.p+3,W=d.v+x;if(P>=24&&(strict?W/P>1/3:W/P>=1/3-1e-9))return x}return null};
 const w=D.dk.filter(d=>d.risk!=='Baixo').sort((a,b)=>b.wr-a.wr);
 const cell=v=>v===null?'<span class="p-low">fora de alcance</span>':v===0?'<span class="pill p-crit">já cruza</span>':`<b>${v}</b> de 3`;
 $('#watch').innerHTML=`<thead><tr><th>Deck</th><th class="r">Partidas</th><th class="r hm">V-E-D</th><th class="r">Win rate</th><th class="r hm">Faltam p/ 24</th><th class="r">Vitórias p/ ban (regra &gt;)</th><th class="r hm">Vitórias p/ ban (planilha ≥)</th><th>Risco</th></tr></thead><tbody>`+
  w.map(d=>`<tr><td>${dLink(d.n)}</td><td class="r num">${d.p}</td><td class="r num hm">${d.v}-${d.e}-${d.d}</td><td class="r num">${fmt(d.wr,2)}%</td><td class="r num hm">${Math.max(0,24-d.p)}</td><td class="r num">${cell(need(d,true))}</td><td class="r num hm">${cell(need(d,false))}</td><td><span class="pill ${d.risk==='Alto'||d.risk==='Banido'?'p-crit':'p-warn'}">${d.risk}</span></td></tr>`).join('')+'</tbody>';
 const ne=nextEv&&nextEv.et?`a ${nextEv.n} (${dm(nextEv.t)})`:'a próxima etapa';
 $('#rulenote').innerHTML=`Projeção para ${ne} supondo um único piloto por deck (3 partidas suíças, sem mesa final). <b>Divergência:</b> o regulamento diz "superior a 33,33%", a aba Ranking Decks diz "33,33% ou mais". Endless Punishment está exatamente em 7/21: com 1 vitória em 3 jogos fica em 8/24 = 33,33%, banido pela planilha e liberado pelo regulamento. A organização precisa fixar qual vale antes da etapa.`;})();

// ===== Comparativo 2025 x 2026
(()=>{const s=a=>a.reduce((x,y)=>x+y,0);
 const g25=s(Y.dk25.map(d=>d.p)),w25=s(Y.dk25.map(d=>d.v)),e25=s(Y.dk25.map(d=>d.e));
 const g26=s(D.dk.map(d=>d.p)),w26=s(D.dk.map(d=>d.v)),e26=s(D.dk.map(d=>d.e));
 const nw25=1-w25/(g25/4),nw26=1-w26/(g26/4);
 const top5=(arr,tot)=>s([...arr].sort((a,b)=>b.p-a.p).slice(0,5).map(d=>d.p))/tot;
 const n25=new Set(Y.names25);const back=D.pl.filter(p=>n25.has(p.n.toLowerCase())).length;
 const pct=v=>fmt(v*100,1)+'%';
 $('#cmpSub').textContent=`2025 é o ano fechado (planilha Consolidado PRECON BH 2025). 2026 vai até a Etapa ${pad(lastEt)}. Por isso os totais não se comparam direto; olhe as taxas.`;
 const K=[['Partidas jogadas (jogador × rodada)',fmt(g25),fmt(g26),`ano inteiro × ${ets.length} etapas`],
  ['Mesas terminadas sem vencedor',pct(nw25),pct(nw26),'vitórias ÷ mesas de 4'],
  ['Resultados de empate',pct(e25/g25),pct(e26/g26),'por partida de jogador'],
  ['Decks diferentes',fmt(Y.dk25.length),fmt(D.dk.length),''],
  ['Partidas nos 5 decks mais jogados',pct(top5(Y.dk25,g25)),pct(top5(D.dk,g26)),'concentração do meta'],
  ['Jogadores de 2026 que jogaram 2025',`${back} de ${D.pl.length}`,'','']];
 $('#cmpk').innerHTML=K.map(([l,a,b,n])=>`<div class="cmpk"><span class="l">${l}</span><div class="v">${b?`<div><small>2025</small><span class="c25">${a}</span></div><div><small>2026</small><span class="c26">${b}</span></div>`:`<div><span>${a}</span></div>`}</div>${n?`<span class="eyebrow" data-style="letter-spacing:.04em;text-transform:none">${n}</span>`:''}</div>`).join('');

 function dumbbell(el,items,kind){chart(el,W=>{const rowH=28,m={l:Math.min(150,Math.round(W*.36)),r:46,t:24,b:8},H=m.t+m.b+items.length*rowH,iw=W-m.l-m.r;
  const max=Math.max(60,Math.ceil(Math.max(...items.flatMap(i=>[i.a,i.b]))/10)*10);const x=v=>m.l+v/max*iw;const step=iw<220?20:10;
  const maxCh=Math.floor((m.l-12)/6.6);
  let sv=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
  for(let v=0;v<=max;v+=step)sv+=`<line x1="${x(v)}" x2="${x(v)}" y1="${m.t-6}" y2="${H-m.b}" stroke="var(--line)"/><text x="${x(v)}" y="${m.t-10}" text-anchor="middle">${v}%</text>`;
  sv+=`<line x1="${x(33.33)}" x2="${x(33.33)}" y1="${m.t-6}" y2="${H-m.b}" stroke="var(--crit)" stroke-dasharray="3 4"/>`;
  items.forEach((it,i)=>{const cy=m.t+i*rowH+rowH/2;const nm=it.n.length>maxCh?it.n.slice(0,maxCh-1)+'…':it.n;
   sv+=`<text x="${m.l-10}" y="${cy+4}" text-anchor="end" data-style="fill:var(--ink);font-family:var(--f-body);font-size:12.5px">${esc(nm)}</text>`;
   sv+=`<line x1="${x(it.a)}" x2="${x(it.b)}" y1="${cy}" y2="${cy}" stroke="var(--ink-3)" stroke-width="2"/>`;
   sv+=`<circle class="pp" data-style="--i:${i}" cx="${x(it.a)}" cy="${cy}" r="5.5" fill="var(--y25)" stroke="var(--surface)" stroke-width="2"/><circle class="pp" data-style="--i:${i+3}" cx="${x(it.b)}" cy="${cy}" r="5.5" fill="var(--y26)" stroke="var(--surface)" stroke-width="2"/>`;
   const d=it.b-it.a;sv+=`<text x="${W-4}" y="${cy+4}" text-anchor="end" data-style="fill:${d>=0?'var(--good)':'var(--crit)'}">${d>=0?'+':''}${fmt(d,1)}</text>`;
   sv+=`<rect x="0" y="${cy-rowH/2}" width="${W}" height="${rowH}" fill="transparent" data-style="cursor:pointer" data-${kind}="${esc(it.n)}" data-t="<b>${esc(it.n)}</b><br>2025: ${fmt(it.a,1)}% em ${it.pa} partidas<br>2026: ${fmt(it.b,1)}% em ${it.pb} partidas"/>`});
  return sv+`<text x="${W-4}" y="${m.t-10}" text-anchor="end">Δ p.p.</text></svg>`},
  e=>e.querySelectorAll(`[data-${kind}]`).forEach(r=>r.addEventListener('click',()=>(kind==='deck'?openDeck:openPlayer)(r.dataset[kind]))))}
 dumbbell($('#dbDecks'),Y.dk25.filter(d=>d.p>=6&&dkBy[d.n]?.p>=6).map(d=>({n:d.n,a:d.v/d.p*100,b:dkBy[d.n].wr,pa:d.p,pb:dkBy[d.n].p})).sort((a,b)=>b.b-a.b),'deck');
 dumbbell($('#dbPl'),Y.pl25.map(p=>({p,q:plBy[p.n.toLowerCase()]})).filter(({q})=>q&&q.v+q.e+q.d>=9).map(({p,q})=>({n:q.n,a:p.v/p.p*100,b:q.wr,pa:p.p,pb:q.v+q.e+q.d})).sort((a,b)=>b.b-a.b),'player');

 const box=(t,rows,f,extra='')=>`<div class="box"><span class="eyebrow">${t}</span>${rows.map((r,i)=>`<div class="row"><span>${i+1}. ${esc(r.n)}</span><span class="num muted">${f(r)}</span></div>`).join('')}${extra}</div>`;
 const wr=r=>fmt(r.v/r.p*100,1)+'%';
 $('#tri25').innerHTML=box('1ª liga trimestral',[],()=>'','<span class="dk">Sem link no menu da planilha 2025. Dados não incluídos.</span>')+box('2ª liga trimestral · top 5',Y.tri['2T'].slice(0,5),r=>fmt(r.pts,2)+' pts')+box('3ª liga trimestral · top 5',Y.tri['3T'].slice(0,5),r=>fmt(r.pts,2)+' pts')+box('Maior win rate 2025 · mín. 9 partidas',Y.pl25.slice(0,5),wr)+box('Decks com mais pontos 2025',[...Y.dk25].sort((a,b)=>b.pts-a.pts).slice(0,5),r=>r.pts+' pts');
 $('#note25').innerHTML=`<b>Leitura:</b> em 2026 a proporção de mesas que acabam sem vencedor dobrou (${pct(nw25)} para ${pct(nw26)}). Isso é tempo estourando, não equilíbrio de decks, e é o que achata o win rate de todo mundo. Na base de 2025 os nomes foram padronizados para comparar (Scions and Spellcraft, Hosts of Mordor, Science). Decks Secret Lair que apareceram em 2025 (SLD Angels, SLD Cats and Dogs) são banidos em 2026.`;
})();

// ===== Calendário
$('#cal').innerHTML=CAL.filter(c=>!c.et||c.et>=lastEt).map(c=>{const past=c.t<now,nx=c===nextEv;
 const obs=c.et&&byEt[c.et]?`${byEt[c.et].length} jogadores · ${pend.has(c.et)?'final pendente':'campeão '+esc(byEt[c.et][0].j)}`:nx?'inscrições abertas':c.obs||(c.et?'':'a confirmar');
 return `<div class="ev ${past?'past':''} ${nx?'nx':''}"><div class="dt"><b>${pad(c.t.getDate())}</b><small>${MES[c.t.getMonth()+1]}</small></div>
  <div><b>${esc(c.n)}</b><div class="muted" data-style="font-size:13px">${DIAS[c.t.getDay()]} · 10:00${obs?' · '+obs:''}</div></div>
  <div class="l">${c.form?`<a href="${c.form}" target="_blank" rel="noopener">Inscrição ↗</a>`:''}${c.emp?`<a href="${c.emp}" target="_blank" rel="noopener">EMP ↗</a>`:''}</div></div>`}).join('');

// ===== Fichas (jogador e deck)
const dlg=$('#dlg'),dlgB=$('#dlgBody');
function openDlg(html){hideTip();dlgB.innerHTML=html;dlgB.querySelector('.x').onclick=()=>dlg.close();if(!dlg.open)dlg.showModal();dlg.scrollTop=0}
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
const hdr=(eb,t)=>`<div class="dlg-h"><div data-style="display:grid;gap:4px;min-width:0"><span class="eyebrow">${eb}</span><h3 id="dlgT">${esc(t)}</h3></div><button class="x" aria-label="Fechar">×</button></div>`;
const stat=(b,s)=>`<div class="stat"><b>${b}</b><span>${s}</span></div>`;
// Nome do jogador abre o perfil completo no sistema da liga
function openPlayer(name){location.href=profUrl(name)}
// Nome do deck abre a página do deck no sistema da liga
function openDeck(name){location.href=deckUrl(name)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-player],[data-deck]');if(!b||b.tagName!=='BUTTON')return;b.dataset.player?openPlayer(b.dataset.player):openDeck(b.dataset.deck)});

// ===== Entrada animada
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
 const count=b=>{const html=b.innerHTML,m=html.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/);if(!m)return;const txt=m[0],dec=(txt.split(',')[1]||'').length,val=parseFloat(txt.replace(/\./g,'').replace(',','.'));
  const t0=performance.now(),dur=1100;const step=now=>{const q=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-q,3);b.innerHTML=html.replace(txt,fmt(val*e,dec));if(q<1)requestAnimationFrame(step);else b.innerHTML=html};requestAnimationFrame(step)};
 const els=[$('#kpis'),...document.querySelectorAll('.card')];els.forEach(e=>e.classList.add('rv'));
 let raceAuto=false;
 const io=new IntersectionObserver(es=>es.forEach(en=>{if(!en.isIntersecting)return;const t=en.target;io.unobserve(t);t.classList.add('in');setTimeout(()=>t.classList.add('done'),2600);
  if(t.id==='kpis')t.querySelectorAll('.kpi b').forEach(count);
  if(!raceAuto&&t.contains($('#rbars'))){raceAuto=true;replay.auto()}}),{threshold:.12,rootMargin:'0px 0px -6% 0px'});
 els.forEach(e=>io.observe(e));
}

}
