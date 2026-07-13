/* ============================================================
   VAULT22 INVESTOR LEADERBOARD - app engine
   Mock prototype. Not financial advice. "Inspired By" model
   portfolios are educational and not official investor portfolios.
   ============================================================ */
'use strict';

/* ---------- tiny utilities ---------- */
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const el = (h)=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild;};
const esc = (s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n)=> (n>=0?'+':'') + n.toFixed(1) + '%';
const money = (n)=> '$' + Math.round(n).toLocaleString('en-US');

/* deterministic PRNG so charts are stable (no Math.random) */
function rng(seed){let a=seed>>>0;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function series(seed,n,drift,vol){const r=rng(seed);let v=100,out=[v];for(let i=1;i<n;i++){const shock=(r()-0.5)*vol;v=Math.max(8,v*(1+drift/n)+shock);out.push(v);}return out;}

/* ---------- SVG charts ---------- */
function sparkline(seed, up, w=260, h=44){
  const pts = series(seed, 34, up?9:2, up?2.4:3.2);
  const min=Math.min(...pts),max=Math.max(...pts),rng=(max-min)||1;
  const step=w/(pts.length-1);
  const xy=pts.map((p,i)=>[i*step, h-4-((p-min)/rng)*(h-8)]);
  const line=xy.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+` L${w} ${h} L0 ${h} Z`;
  const pos = pts[pts.length-1]>=pts[0];
  const col = pos? '#34D399':'#FB7185';
  const id='sg'+seed+(''+w);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}
function perfChart(seed, up, w=680, h=200){
  const pts = series(seed, 60, up?10:3, up?2.2:3.4);
  const min=Math.min(...pts),max=Math.max(...pts),rg=(max-min)||1;
  const step=w/(pts.length-1);
  const xy=pts.map((p,i)=>[i*step, h-18-((p-min)/rg)*(h-40)]);
  const line=xy.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+` L${w} ${h} L0 ${h} Z`;
  const id='pg'+seed;
  const grid=[0.25,0.5,0.75].map(f=>`<line x1="0" x2="${w}" y1="${h*f}" y2="${h*f}" stroke="rgba(10,20,32,.06)" stroke-width="1"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#DC0032" stop-opacity=".28"/><stop offset="1" stop-color="#DC0032" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="#DC0032" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}
function donut(data, size=118, thick=false){
  let cum=0, stops=[];
  const total=data.reduce((s,d)=>s+d.v,0)||1;
  data.forEach((d,i)=>{const c=PIE_COLORS[i%PIE_COLORS.length];const a0=cum/total*360;cum+=d.v;const a1=cum/total*360;stops.push(`${c} ${a0.toFixed(2)}deg ${a1.toFixed(2)}deg`);});
  const hole = thick? '62%':'58%';
  return `<div class="donut-anim" style="width:${size}px;height:${size}px;flex:none;border-radius:50%;background:conic-gradient(${stops.join(',')});
    -webkit-mask:radial-gradient(farthest-side,transparent ${hole},#000 calc(${hole} + 1px));mask:radial-gradient(farthest-side,transparent ${hole},#000 calc(${hole} + 1px))"></div>`;
}
function pieBlock(data, size=118){
  const legend = data.map((d,i)=>`<div class="li"><span class="dot" style="background:${PIE_COLORS[i%PIE_COLORS.length]}"></span><span>${esc(d.k||d.n)}</span><span class="pc">${d.v}%</span></div>`).join('');
  return `<div class="pie-wrap">${donut(data,size)}<div class="pie-legend">${legend}</div></div>`;
}
function matchRing(pct){
  const r=22,c=2*Math.PI*r,off=c*(1-pct/100);
  const col = pct>=80?'#34D399':pct>=60?'#168335':pct>=45?'#FBBF24':'#FB7185';
  return `<div class="match-ring"><svg viewBox="0 0 52 52" style="width:52px;height:52px;transform:rotate(-90deg)">
    <circle cx="26" cy="26" r="${r}" fill="none" stroke="rgba(10,20,32,.10)" stroke-width="5"/>
    <circle cx="26" cy="26" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
  </svg><span class="lbl" style="color:${col}">${pct}%</span></div>`;
}
function hbars(data, unit='%'){
  const max=Math.max(...data.map(d=>d.v))||1;
  return `<div class="hbar">`+data.map((d,i)=>`<div class="row"><span>${esc(d.k||d.n)}</span>
    <span class="track"><i style="width:${(d.v/max*100).toFixed(0)}%;background:linear-gradient(90deg,${PIE_COLORS[i%PIE_COLORS.length]},${PIE_COLORS[i%PIE_COLORS.length]}99)"></i></span>
    <span class="num">${d.v}${unit}</span></div>`).join('')+`</div>`;
}
function riskDots(label){
  const map={'Low':1,'Low-Moderate':2,'Moderate':3,'Moderate-High':4,'High':4,'Very High':5,'Extreme':5};
  const n=map[label]||3;const col=n<=2?'#34D399':n===3?'#FBBF24':'#FB7185';
  let d='';for(let i=0;i<5;i++)d+=`<span style="width:7px;height:7px;border-radius:50%;background:${i<n?col:'rgba(10,20,32,.16)'}"></span>`;
  return `<span style="display:inline-flex;gap:3px;align-items:center">${d}</span>`;
}
/* metric with educational tooltip */
function metric(label, val, key, cls=''){
  const has = METRICS[key||label];
  const help = has? `<span class="help" data-tip="${esc(key||label)}">i</span>`:'';
  return `<div class="metric"><span class="k">${esc(label)} ${help}</span><span class="val ${cls}">${val}</span></div>`;
}

/* ---------- toast ---------- */
function toast(msg){
  const t=el(`<div class="toast"><span class="i">✓</span><span>${esc(msg)}</span></div>`);
  $('#toastWrap').appendChild(t);
  setTimeout(()=>{t.style.transition='.3s';t.style.opacity='0';t.style.transform='translateY(10px)';setTimeout(()=>t.remove(),320);},2600);
}

/* ---------- following state ---------- */
const Follow = {
  set:new Set(['c1','buffett']),
  has(id){return this.set.has(id);},
  toggle(id,name){name=name||(findEntity(id)||{}).name||'this portfolio';if(this.set.has(id)){this.set.delete(id);toast('Unfollowed '+name);}else{this.set.add(id);toast('Following '+name+'. You will be notified of changes.');}dnaRefresh();if(App.view==='following')App.render();}
};

/* ---------- tooltips ---------- */
const tip=$('#tip');
document.addEventListener('mouseover',e=>{
  const t=e.target.closest('[data-tip]');if(!t)return;
  const m=METRICS[t.dataset.tip];if(!m)return;
  tip.innerHTML=`<div class="tt">${esc(t.dataset.tip)}</div><div>${esc(m.d)}</div>`+(m.tara?`<div class="tara-line"><span class="tara-orb" style="width:16px;height:16px;flex:none"></span><span>${esc(m.tara)}</span></div>`:'');
  const r=t.getBoundingClientRect();tip.classList.add('show');
  let x=r.left, y=r.bottom+8;
  requestAnimationFrame(()=>{const tw=tip.offsetWidth,th=tip.offsetHeight;
    if(x+tw>innerWidth-12)x=innerWidth-tw-12;if(y+th>innerHeight-12)y=r.top-th-8;
    tip.style.left=Math.max(12,x)+'px';tip.style.top=Math.max(12,y)+'px';});
});
document.addEventListener('mouseout',e=>{if(e.target.closest('[data-tip]'))tip.classList.remove('show');});

/* ============================================================
   NAV + ROUTER
   ============================================================ */
const ICONS={
  foryou:'<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  community:'<circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 20a6 6 0 0112 0M16 6a3 3 0 010 6M21 20a6 6 0 00-4-5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  legends:'<path d="M7 4h10v4a5 5 0 01-10 0V4zM5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3M9 20h6M12 14v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  strategies:'<path d="M4 19V5M4 19h16M8 15l3-4 3 3 4-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  compare:'<path d="M12 3v18M7 8L3 12l4 4M17 8l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  following:'<path d="M12 20s-7-4.4-9.2-8.4C1.2 8.6 3 5.5 6.2 5.5c1.9 0 3.1 1 3.8 2 .7-1 1.9-2 3.8-2 3.2 0 5 3.1 3.4 6.1C19 15.6 12 20 12 20z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  home:'<path d="M4 11l8-7 8 7M6 10v9h4v-5h4v5h4v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  accounts:'<rect x="3" y="6" width="18" height="13" rx="2.4" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  goals:'<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" stroke="currentColor" stroke-width="1.8"/>',
  budget:'<path d="M12 4a8 8 0 108 8h-8V4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 4a8 8 0 016 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  invest:'<path d="M4 16l5-5 3 3 7-8M15 6h5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  rewards:'<rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 8v12M9 8a2 2 0 110-4c2 0 3 4 3 4M15 8a2 2 0 100-4c-2 0-3 4-3 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
};
/* Vault22 app-level sections (representative of the wider app) */
const APP_SECTIONS=[{id:'home',label:'Home'},{id:'accounts',label:'Accounts'},{id:'goals',label:'Goals'},{id:'budget',label:'Budget'}];
/* the Invest group: Leaderboard sits alongside the existing Invest screens */
const INVEST_CHILDREN=[{key:'portfolio',label:'Portfolio',nav:'portfolio'},{key:'forecast',label:'Market Forecast',nav:'forecast'},{key:'leaderboard',label:'Leaderboard',nav:'foryou'}];
/* the Leaderboard's own sections become inner sub-tabs */
const LB_TABS=[{id:'foryou',label:'For You'},{id:'community',label:'Community'},{id:'legends',label:'Market Legends'},{id:'strategies',label:'Strategies'},{id:'compare',label:'Compare'},{id:'following',label:'Following'}];
const LB_SET=new Set(['foryou','community','legends','strategies','compare','following','search']);

const App={
  view:'foryou',
  legendFilter:'all', legendSearch:'', communityFilter:'all', strategyFilter:'all', query:'',
  init(){
    // ----- Vault22 app sidebar (main sections + Invest group with Leaderboard) -----
    let s='';
    APP_SECTIONS.forEach(n=>{s+=`<a class="nav-item" data-nav="${n.id}"><svg class="ic" viewBox="0 0 24 24" fill="none">${ICONS[n.id]}</svg><span>${n.label}</span></a>`;});
    s+=`<div class="nav-group" id="investGroup">
      <div class="nav-parent" onclick="toggleInvest(event)" role="button" tabindex="0" aria-expanded="true" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleInvest(event)}"><svg class="ic" viewBox="0 0 24 24" fill="none">${ICONS.invest}</svg><span>Invest</span><svg class="chev" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="nav-children">${INVEST_CHILDREN.map(c=>`<a class="nav-child" data-nav="${c.nav}" data-invest="${c.key}"><span class="dot"></span><span>${c.label}</span></a>`).join('')}</div>
    </div>`;
    s+=`<a class="nav-item" data-nav="rewards"><svg class="ic" viewBox="0 0 24 24" fill="none">${ICONS.rewards}</svg><span>Rewards</span></a>`;
    $('#nav').innerHTML=s;
    // ----- inner Leaderboard sub-tabs -----
    $('#subtabs').innerHTML=LB_TABS.map(t=>{
      const cnt=t.id==='following'?`<span class="cnt" id="navFollowCount">${Follow.set.size}</span>`:'';
      return `<button class="subtab" data-nav="${t.id}" role="tab">${t.label}${cnt}</button>`;
    }).join('');
    document.addEventListener('click',e=>{const t=e.target.closest('[data-nav]');if(t){e.preventDefault();this.go(t.dataset.nav);}});
    // search (a Leaderboard capability)
    const gs=$('#globalSearch');
    gs.addEventListener('input',()=>{this.query=gs.value.trim();if(this.query&&this.view!=='search'){this._prev=LB_SET.has(this.view)?this.view:'foryou';this.view='search';}if(!this.query&&this.view==='search'){this.view=this._prev||'foryou';}this.render();this.syncNav();});
    document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==gs){e.preventDefault();gs.focus();}if(e.key==='Escape'){closeAll();toggleNav(false);}});
    dnaRefresh();
    this.go('foryou');
  },
  go(v){this.view=v;this.query='';const gs=$('#globalSearch');if(gs)gs.value='';toggleNav(false);window.scrollTo({top:0,behavior:'smooth'});this.render();this.syncNav();_routePushView();},
  syncNav(){
    const v=this.view;
    const investKey=LB_SET.has(v)?'leaderboard':(v==='portfolio'?'portfolio':v==='forecast'?'forecast':null);
    $$('.nav-item[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===v));
    $$('.nav-child[data-invest]').forEach(a=>a.classList.toggle('active',a.dataset.invest===investKey));
    const inLB=LB_SET.has(v);const st=$('#subtabs');if(st)st.classList.toggle('hidden',!inLB);
    $$('.subtab[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===(v==='search'?null:v)));
    const fc=$('#navFollowCount');if(fc)fc.textContent=Follow.set.size;
  },
  _visited:new Set(),
  render(){
    const c=$('#content');
    const heavy=['community','legends','strategies'].includes(this.view)&&!this.query;
    if(heavy&&!this._visited.has(this.view)){this._visited.add(this.view);c.innerHTML=skeletonGrid();setTimeout(()=>this._paint(),260);return;}
    this._paint();
  },
  _paint(){
    const c=$('#content');
    const lb={foryou:viewForYou,community:viewCommunity,legends:viewLegends,strategies:viewStrategies,compare:viewCompare,following:viewFollowing,search:viewSearch};
    const other={portfolio:viewPortfolio,forecast:viewForecast};
    const fn=lb[this.view]||other[this.view];
    c.innerHTML=`<div class="view active">${fn?fn():viewStub(this.view)}</div>`;
    postRender(c, LB_SET.has(this.view)?this.view:null);
  }
};
/* Invest group expand/collapse (matches the app's collapsible section) */
function toggleInvest(e){if(e&&e.stopPropagation)e.stopPropagation();const g=document.getElementById('investGroup');if(!g)return;g.classList.toggle('collapsed');const p=g.querySelector('.nav-parent');if(p)p.setAttribute('aria-expanded',String(!g.classList.contains('collapsed')));}
/* mobile drawer toggle */
function toggleNav(open){const sb=$('#sidebar'),sc=$('#navScrim');if(!sb)return;const wasOpen=sb.classList.contains('open');const show=(open===undefined)?!wasOpen:!!open;sb.classList.toggle('open',show);if(sc)sc.classList.toggle('show',show);if(show&&!wasOpen&&typeof _routePushModal==='function')_routePushModal();}
/* native sibling Invest screens + other app sections (representative placeholders) */
function viewPortfolio(){
  return `
  <div class="page-head"><h1>Portfolio</h1><div class="sub">Your investments across Absa</div></div>
  <div class="grid cols-3" style="margin-bottom:18px">
    <div class="card" style="grid-column:span 1;display:flex;flex-direction:column;justify-content:center"><div class="metric"><span class="k">Total value</span><span class="val" style="font-size:30px">${money(128450)}</span></div><div style="margin-top:10px"><span class="pill pos">+9.5% all time</span></div></div>
    <div class="card" style="grid-column:span 2"><b style="display:block;margin-bottom:14px">Allocation</b>${pieBlock(USER.allocation,120)}</div>
  </div>
  <div class="card" style="margin-bottom:18px"><b style="display:block;margin-bottom:14px">Holdings</b>${hbars(USER.holdings)}</div>
  <div class="stub" style="margin:8px auto 0"><span class="note">Existing Absa Invest screen</span><p style="margin:0 0 22px">The Investor Leaderboard is the new module in this section. Open it from the Invest menu to learn from proven styles and build your own version.</p><button class="btn btn-primary" data-nav="foryou">Open Leaderboard</button></div>`;
}
function viewForecast(){
  return `
  <div class="page-head"><h1>Market Forecast</h1><div class="sub">Scenario ranges for major asset classes</div></div>
  <div class="card" style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>Illustrative 10-year outlook</b><span class="pill">Base case</span></div>${miniArea(project(10000,0,10,0.08).series)}<div style="font-size:11.5px;color:var(--ink-mute);margin-top:8px">Illustrative projection only. Not a forecast or advice.</div></div>
  <div class="stub" style="margin:8px auto 0"><span class="note">Existing Absa Invest screen</span><p style="margin:0 0 22px">Market Forecast is a separate Invest module. The Investor Leaderboard sits alongside it in this section.</p><button class="btn btn-primary" data-nav="foryou">Open Leaderboard</button></div>`;
}
function viewStub(id){
  const map={home:['🏠','Home'],accounts:['🏦','Accounts'],goals:['🎯','Goals'],budget:['📊','Budget'],rewards:['🎁','Rewards']};
  const m=map[id]||['📱','Vault22'];
  return `<div class="stub"><div class="stub-ic">${m[0]}</div><h2>${m[1]}</h2><div style="margin-bottom:16px"><span class="note">Part of the main Vault22 app</span></div><p>This section belongs to the wider Vault22 experience. This prototype focuses on the new <b>Investor Leaderboard</b> inside Invest.</p><button class="btn btn-primary" data-nav="foryou">Go to Leaderboard</button></div>`;
}
/* notifications popover (fed by followed / recently-updated investors: the "get notified when a portfolio changes" promise) */
const Notifs={
  open:false,
  toggle(e){if(e&&e.stopPropagation)e.stopPropagation();this.open?this.close():this.show();},
  show(){
    const p=$('#notifPop');if(!p)return;
    const items=COMMUNITY.filter(c=>c.changes&&c.changes.length).slice(0,4);
    p.innerHTML=`<div class="notif-head">Notifications <span class="cnt">${items.length} new</span></div>`+
      items.map(c=>`<button class="notif-row hoverable" onclick="Notifs.close();openProfile('${c.id}')">${avatarHTML(c,36,11)}<div style="min-width:0"><div class="nt">${esc(c.name)}</div><div class="nd">Updated: ${esc(c.changes[0][0])}</div></div><div class="nw">${esc(c.changes[0][1])}</div></button>`).join('')+
      `<div class="notif-foot">You are all caught up</div>`;
    p.classList.add('show');this.open=true;
    const d=$('#notifDot');if(d)d.style.display='none';
  },
  close(){const p=$('#notifPop');if(p)p.classList.remove('show');this.open=false;}
};
document.addEventListener('click',e=>{if(Notifs.open){const p=$('#notifPop'),b=$('#notifBell');if(p&&!p.contains(e.target)&&b&&!b.contains(e.target))Notifs.close();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')Notifs.close();});
function skeletonGrid(){
  const card=`<div class="sk-card"><div style="display:flex;gap:12px;align-items:center"><div class="skeleton" style="width:52px;height:52px;border-radius:15px"></div><div style="flex:1"><div class="skeleton sk-line" style="width:60%"></div><div class="skeleton sk-line" style="width:40%;margin-top:8px"></div></div></div><div class="skeleton" style="height:44px;border-radius:10px"></div><div class="skeleton" style="height:60px;border-radius:10px"></div><div class="skeleton" style="height:38px;border-radius:10px;margin-top:auto"></div></div>`;
  return `<div style="height:26px"></div><div class="grid auto-cards">${card.repeat(6)}</div>`;
}
function postRender(scope,view){
  requestAnimationFrame(()=>{
    scope.querySelectorAll('.hbar .track>i').forEach(i=>{const w=i.style.width;i.style.width='0';requestAnimationFrame(()=>i.style.width=w);});
    scope.querySelectorAll('.health-ring circle[data-dash]').forEach(c=>{requestAnimationFrame(()=>c.style.strokeDashoffset=c.getAttribute('data-dash'));});
    scope.querySelectorAll('.meter>i[data-w]').forEach(i=>{i.style.width='0';requestAnimationFrame(()=>i.style.width=i.getAttribute('data-w')+'%');});
    initCharts(scope);
  });
  if(view)taraContext(view);
}
function dnaRefresh(){
  $('#dnaMiniStyle').textContent=USER.dna.style;
  $('#dnaMiniBar').style.width=USER.dna.diversification+'%';
  const n=$('#navFollowCount');if(n)n.textContent=Follow.set.size;
}

/* helper: find any entity by id */
function findEntity(id){return ALL_LEGENDS.find(x=>x.id===id)||COMMUNITY.find(x=>x.id===id)||STRATEGIES.find(x=>x.id===id);}

/* ============================================================
   SHARED CARD RENDERERS
   ============================================================ */
function avatarHTML(e,size=52,rad=15){
  const fs = e.initials.length>2?15:18;
  return `<div class="inv-ava" style="width:${size}px;height:${size}px;border-radius:${rad}px;background:linear-gradient(145deg,${e.c1},${e.c2});font-size:${fs}px">${esc(e.initials)}</div>`;
}
function inspiredTag(){return `<span class="inspired-tag">Inspired By</span>`;}

/* estimated annual fee (%) used for net/gross performance + fee disclosure */
function estFee(e){
  if(e.strategy)return 0.35+(e.cat==='Crypto'?0.25:0)+(e.esg?0.1:0);
  if(e.community)return 0.30;
  if(e.cat==='crypto')return 0.95;
  if(/index|core|whole market|60\/40|balanced model/i.test((e.style||''))||['bogle','sixtyforty'].includes(e.id))return 0.12;
  return 0.55; // active tradfi style
}
/* net-of-fee figure, clearly derived from gross */
function netRet(e){return e.ret3y-estFee(e);}
/* compact 30D / 90D / 1Y / 3Y returns strip (honest: negatives shown red) */
function retRow(e){
  const cell=(lab,v)=> v==null?'' : `<div style="text-align:center"><div style="font-size:10px;color:var(--ink-mute)">${lab}</div><div style="font-weight:700;font-size:13px;color:${v>=0?'#12B76A':'#F04438'}">${fmt(v)}</div></div>`;
  const cells=[cell('30D',e.ret30),cell('90D',e.ret90),cell('1Y',e.ret1y),cell('3Y',e.ret3y)].filter(Boolean).join('');
  const n=cells.match(/text-align:center/g)?.length||4;
  return `<div style="display:grid;grid-template-columns:repeat(${n},1fr);gap:6px;margin:8px 0;padding:8px 6px;border-radius:10px;background:var(--glass-2)">${cells}</div>`;
}
/* all-time rank by risk-adjusted performance (keeps long-term ranking prominent) */
let _rankMap=null;
function allTimeRank(id){if(!_rankMap){_rankMap={};[...COMMUNITY].sort((a,b)=>b.riskAdj-a.riskAdj).forEach((c,i)=>_rankMap[c.id]=i+1);}return _rankMap[id];}
/* compact KPI cell for premium cards (good: true green / false red / null neutral) */
function kpi(label,val,good){
  /* restraint: only the sign-critical negative is coloured (red). positives stay neutral ink so green is reserved for the primary action, active nav and match ring */
  const col=good===false?'var(--neg)':'var(--ink)';
  return `<div class="kpi"><div class="kl">${esc(label)}</div><div class="kv" style="color:${col}">${val}</div></div>`;
}
/* slim stacked allocation bar (replaces bulky donut on cards; donut stays in profile) */
function allocBar(alloc){
  const t=alloc.reduce((s,x)=>s+x.v,0)||1;
  const segs=alloc.map((d,i)=>`<span class="seg-i" style="width:${(d.v/t*100).toFixed(2)}%;background:${PIE_COLORS[i%PIE_COLORS.length]}" title="${esc(d.k)} ${d.v}%"></span>`).join('');
  const top=alloc.slice(0,2).map((d,i)=>`<span class="al-k"><i style="background:${PIE_COLORS[i]}"></i>${esc(d.k)} ${d.v}%</span>`).join('');
  const more=alloc.length>2?`<span class="al-more">+${alloc.length-2} more</span>`:'';
  return `<div class="alloc"><div class="alloc-bar" aria-hidden="true">${segs}</div><div class="alloc-legend">${top}${more}</div></div>`;
}
function heartIcon(){return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
function compareIcon(){return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v18M7 8L3 12l4 4M17 8l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
/* keyboard drill-down: Enter/Space on a card (not its inner buttons) opens the profile */
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const c=e.target.closest&&e.target.closest('[data-profile]');
  if(c&&e.target===c){e.preventDefault();openProfile(c.dataset.profile);}
});

/* community investor card (premium, decluttered: hero line + 3 KPIs + allocation + one primary action) */
function communityCard(e){
  const fol=Follow.has(e.id);
  return `<div class="card lift inv-card" data-profile="${e.id}" onclick="openProfile('${e.id}')" role="button" tabindex="0" aria-label="${esc(e.name)}, ${esc(e.style)}, ${e.match}% match. Open profile.">
    <div class="inv-top">
      ${avatarHTML(e)}
      <div style="min-width:0;flex:1"><div class="inv-name">${esc(e.name)} ${e.shariah?'<span class="pill shariah">Shariah</span>':''}</div>
        <div class="inv-sub">#${allTimeRank(e.id)} all-time · ${esc(e.style)}</div></div>
      ${matchRing(e.match)}
    </div>
    ${sparkline(e.seedp||(e.seedp=hashSeed(e.id)), true)}
    <div class="kpi-row">
      ${kpi('3Y return', fmt(e.ret3y), e.ret3y>=0)}
      ${kpi('Risk level', esc(e.riskLbl), null)}
      ${kpi('Drawdown', e.maxDD+'%', false)}
    </div>
    ${allocBar(e.alloc)}
    <div class="card-foot">
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openBuild('${e.id}')">Build similar</button>
      <div class="icon-acts">
        <button class="icon-mini ${fol?'on':''}" aria-label="${fol?'Following':'Follow'} ${esc(e.name)}" aria-pressed="${fol}" onclick="event.stopPropagation();Follow.toggle('${e.id}');this.setAttribute('aria-pressed',Follow.has('${e.id}'));this.classList.toggle('on',Follow.has('${e.id}'))">${heartIcon()}</button>
        <button class="icon-mini" aria-label="Compare ${esc(e.name)} with you" onclick="event.stopPropagation();openCompare('${e.id}')">${compareIcon()}</button>
        <button class="icon-mini tara" aria-label="Ask Tara if ${esc(e.name)} suits you" onclick="event.stopPropagation();Tara.suit('${e.id}')"><span class="tara-orb" style="width:16px;height:16px"></span></button>
      </div>
    </div>
  </div>`;
}
function hashSeed(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h||7;}

/* descriptor for a card sub-line: crypto legends have no `style`, so fall back to who they are inspired by, then category (never "undefined") */
function styleOf(e){return e.style||(e.by?e.by.replace(/^Inspired by\s*/i,''):'')||({tradfi:'TradFi model',crypto:'Crypto model'}[e.cat])||e.cat||'';}
/* legend card (premium, decluttered) */
function legendCard(e){
  const up = e.ret3y>=0;
  const m = matchFor(e);
  const fol=Follow.has(e.id);
  return `<div class="card lift inv-card" data-profile="${e.id}" onclick="openProfile('${e.id}')" role="button" tabindex="0" aria-label="${esc(e.name)}, ${esc(styleOf(e))}, inspired-by model, ${m}% match. Open model portfolio.">
    <div class="inv-top">
      ${avatarHTML(e)}
      <div style="min-width:0;flex:1"><div class="inv-name">${esc(e.name)} ${e.shariah?'<span class="pill shariah">Shariah</span>':''}</div>
        <div class="inv-sub">${esc(styleOf(e))}<span class="tag-inline">Inspired by</span></div></div>
      ${matchRing(m)}
    </div>
    <div class="tag-line"><span>${riskDots(e.risk)} ${esc(e.risk)} risk</span><span class="dotsep">·</span><span>${esc(e.horizon||e.hold)} horizon</span></div>
    ${sparkline(hashSeed(e.id), up)}
    <div class="kpi-row">
      ${kpi('3Y return', fmt(e.ret3y), up)}
      ${kpi('Drawdown', e.maxDD+'%', false)}
      ${kpi('Volatility', e.vol+'%', null)}
    </div>
    ${allocBar(e.alloc)}
    <div class="card-foot">
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openBuild('${e.id}')">Build similar</button>
      <div class="icon-acts">
        <button class="icon-mini ${fol?'on':''}" aria-label="${fol?'Following':'Follow'} ${esc(e.name)}" aria-pressed="${fol}" onclick="event.stopPropagation();Follow.toggle('${e.id}');this.setAttribute('aria-pressed',Follow.has('${e.id}'));this.classList.toggle('on',Follow.has('${e.id}'))">${heartIcon()}</button>
        <button class="icon-mini tara" aria-label="Ask Tara if this suits you" onclick="event.stopPropagation();Tara.suit('${e.id}')"><span class="tara-orb" style="width:16px;height:16px"></span></button>
      </div>
    </div>
  </div>`;
}

/* strategy card (premium, decluttered) */
function strategyCard(e){
  const fol=Follow.has(e.id);
  return `<div class="card lift inv-card" data-profile="${e.id}" onclick="openProfile('${e.id}')" role="button" tabindex="0" aria-label="${esc(e.name)} strategy, inspired-by model. Open model portfolio.">
    <div class="inv-top">
      <div class="inv-ava" style="background:linear-gradient(145deg,${e.c1},${e.c2});font-size:22px" aria-hidden="true">${e.icon}</div>
      <div style="min-width:0;flex:1"><div class="inv-name">${esc(e.name)} ${e.shariah?'<span class="pill shariah">Shariah</span>':''}${e.esg?'<span class="pill violet">ESG</span>':''}</div>
        <div class="inv-sub">${esc(e.cat)} · ${esc(e.risk)} risk<span class="tag-inline">Inspired by</span></div></div>
    </div>
    <div class="strat-explain">${esc(e.explain)}</div>
    ${sparkline(hashSeed(e.id), e.risk!=='Extreme')}
    <div class="kpi-row">
      ${kpi('Target', e.ret.replace(' target','').replace(/highly variable/i,'Variable'), null)}
      ${kpi('Drawdown', e.maxDD+'%', false)}
      ${kpi('Horizon', e.horizon.replace(/\+? years?/,'y+'), null)}
    </div>
    ${allocBar(e.alloc)}
    <div class="card-foot">
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openBuild('${e.id}')">Build portfolio</button>
      <div class="icon-acts">
        <button class="icon-mini ${fol?'on':''}" aria-label="${fol?'Following':'Follow'} ${esc(e.name)}" aria-pressed="${fol}" onclick="event.stopPropagation();Follow.toggle('${e.id}');this.setAttribute('aria-pressed',Follow.has('${e.id}'));this.classList.toggle('on',Follow.has('${e.id}'))">${heartIcon()}</button>
      </div>
    </div>
  </div>`;
}

/* compliance disclaimer block */
function disclaimer(text){
  return `<div class="disclaimer"><svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${text}</span></div>`;
}
const COMPLIANCE_NOTE='These are educational model portfolios showing similar exposure to well-known styles. They are not official portfolios of any named investor, not advice, and past or illustrative performance does not guarantee future returns. *Figures are illustrative for this prototype. Capital is at risk.';

/* ============================================================
   VIEW: FOR YOU (personalised dashboard)
   ============================================================ */
function viewForYou(){
  const d=USER.dna;const hs=healthScore();
  const matches=[...COMMUNITY].sort((a,b)=>b.match-a.match).slice(0,3);
  const legendMatches=[...ALL_LEGENDS].map(l=>({l,m:matchFor(l)})).sort((a,b)=>b.m-a.m).slice(0,3);
  const recent=COMMUNITY.filter(c=>c.changes&&c.changes.length).slice(0,4);
  const following=[...Follow.set].map(findEntity).filter(Boolean);
  const viewed=Personal.recent.map(findEntity).filter(Boolean);
  const actions=[
    {t:'Widen geography beyond North America',impact:'High',fn:"openCompare('c12')"},
    {t:'Add real assets (REITs, gold) for balance',impact:'Medium',fn:"openProfile('swensen')"},
    {t:'Automate monthly contributions',impact:'Medium',fn:"Tara.ask('How do monthly contributions help?')"},
    {t:'Trim single-stock tech concentration',impact:'Low',fn:"openProfile('smith')"}
  ];
  return `
  <section class="hero">
    <div class="hero-inner">
      <span class="pill violet" style="margin-bottom:16px"><span class="tara-orb" style="width:14px;height:14px"></span> AI-personalised for ${esc(USER.name.split(' ')[0])}</span>
      <h1>Learn from proven <span class="g">investing styles</span>,<br/>then build your own version.</h1>
      <p>Not copy trading. Study how proven investors build wealth, then shape a version that fits your plan in three steps.</p>
      <div class="hero-cta">
        <button class="btn btn-primary" data-nav="legends">Explore Market Legends</button>
        <button class="btn btn-ghost" onclick="Tara.open()"><span class="tara-orb" style="width:16px;height:16px"></span> Ask Tara what suits me</button>
      </div>
      <div class="hero-stats">
        <div class="s"><div class="n">${ALL_LEGENDS.length}</div><div class="l">Market Legend styles</div></div>
        <div class="s"><div class="n">${COMMUNITY.length}</div><div class="l">Community investors</div></div>
        <div class="s"><div class="n">${STRATEGIES.length}</div><div class="l">Model strategies</div></div>
        <div class="s"><div class="n">3 clicks</div><div class="l">to your version</div></div>
      </div>
    </div>
  </section>

  ${viewed.length?`<div class="section-head"><h2 style="font-size:18px">Recently viewed</h2><div class="sub">Jump back in</div></div>
  <div class="rv-strip">${viewed.map(e=>`<div class="rv" onclick="openProfile('${e.id}')">${e.icon?`<div class="inv-ava" style="width:56px;height:56px;font-size:24px;background:linear-gradient(145deg,${e.c1},${e.c2})">${e.icon}</div>`:avatarHTML(e,56,17)}<span class="lb">${esc(e.name)}</span></div>`).join('')}</div>`:''}

  <div class="section-head"><h2>AI Portfolio Health</h2><div class="sub">How Tara rates your plan right now</div>
    <a class="link" onclick="Tara.health()">Full breakdown <span>›</span></a></div>
  <div class="grid cols-3">
    <div class="card card-sheen" style="display:flex;gap:20px;align-items:center;background:linear-gradient(120deg,rgba(220,0,50,.1),transparent)">
      ${healthRing(hs.score)}
      <div style="flex:1;min-width:0">
        <div style="font-size:20px;font-weight:800">${hs.grade}</div>
        <div style="font-size:12.5px;color:var(--ink-mute);margin-bottom:12px">AI confidence ${hs.confidence}% · updated today</div>
        ${hs.factors.slice(0,3).map(f=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--ink-soft)">${f[0]}</span><b>${f[1]}</b></div><div class="meter" style="height:6px"><i data-w="${f[1]}" style="background:linear-gradient(90deg,var(--teal),var(--sky))"></i></div></div>`).join('')}
      </div>
    </div>
    <div class="card" style="grid-column:span 2">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px"><span class="tara-orb" style="width:22px;height:22px"></span><b>Suggested next actions</b><span class="pill violet" style="margin-left:auto">Ranked by impact</span></div>
      <div style="display:flex;flex-direction:column">
        ${actions.map(a=>`<button style="display:flex;align-items:center;gap:12px;padding:13px 6px;border-bottom:1px solid var(--line);text-align:left;width:100%" onclick="${a.fn}" class="hoverable">
          <span class="pill ${a.impact==='High'?'pos':a.impact==='Medium'?'gold':''}" style="min-width:70px;justify-content:center">${a.impact}</span>
          <span style="flex:1;font-size:14px">${esc(a.t)}</span><span style="color:var(--ink-mute)">›</span></button>`).join('')}
      </div>
    </div>
  </div>

  <div class="section-head"><h2>Your Investor DNA</h2><div class="sub">AI-generated from your holdings, behaviour and risk answers</div>
    <a class="link" onclick="Tara.dna()">Ask Tara to explain <span>›</span></a></div>
  <div class="grid cols-3">
    <div class="card" style="grid-column:span 2">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <span class="pill gold">${esc(d.style)}</span>
        <span class="pill">Risk: ${esc(d.riskProfile)}</span>
        <span class="pill">Horizon: ${esc(d.horizon)}</span>
      </div>
      <div class="hbar">${d.traits.map((t,i)=>`<div class="row"><span>${t[0]}</span><span class="track"><i style="width:${t[2]}%"></i></span><span class="num">${t[1]}</span></div>`).join('')}</div>
      <div class="tara-msg" style="margin-top:16px"><div class="h">Tara summary</div>${esc(d.summary)}</div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      ${[['Diversification',d.diversification,'Diversification Score'],['Consistency',d.consistency,'Consistency Score'],['Behaviour',d.behaviour,'Behaviour Score']].map(x=>`
        <div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span class="k" style="color:var(--ink-soft)">${x[0]} <span class="help" data-tip="${x[2]}">i</span></span><b>${x[1]}/100</b></div>
        <div class="meter" style="height:8px"><i data-w="${x[1]}" style="background:linear-gradient(90deg,var(--teal),var(--sky))"></i></div></div>`).join('')}
      <button class="btn btn-ghost btn-sm" data-nav="compare" style="margin-top:auto">Compare me with an investor</button>
    </div>
  </div>

  <div class="section-head"><h2>Curated collections</h2><div class="sub">Editor's picks and themed shortlists</div></div>
  ${collectionsRail()}

  <div class="section-head"><h2>Best Matches For You</h2><div class="sub">Ranked by AI match to your DNA, not by raw return</div>
    <span class="why" style="margin-left:auto" onclick="TFloat.show('<b>Why these?</b> Your DNA is a Balanced Builder with a moderate risk score of ${d.riskScore} and a long horizon. I surface investors whose risk, diversification and holdings line up with yours, so adopting them is a tilt, not a gamble.','')">Why am I seeing this?</span></div>
  <div class="grid auto-cards">${matches.map(communityCard).join('')}</div>

  <div class="section-head"><h2>Legends worth studying</h2><div class="sub">Market Legend styles closest to your profile</div>
    <a class="link" data-nav="legends">Full library <span>›</span></a></div>
  <div class="grid auto-cards">${legendMatches.map(x=>legendCard(x.l)).join('')}</div>

  <div class="grid cols-2" style="margin-top:34px">
    <div>
      <div class="section-head" style="margin-top:0"><h2 style="font-size:19px">Recently updated portfolios</h2></div>
      <div class="card" style="padding:8px">${recent.map(c=>`
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;cursor:pointer" onclick="openProfile('${c.id}')" class="hoverable">
          ${avatarHTML(c,40,12)}
          <div style="min-width:0;flex:1"><div style="font-weight:600;font-size:14px">${esc(c.name)}</div><div style="font-size:12px;color:var(--ink-mute)">${esc(c.changes[0][0])}</div></div>
          <div style="font-size:12px;color:var(--ink-mute);white-space:nowrap">${esc(c.changes[0][1])}</div>
        </div>`).join('')}</div>
    </div>
    <div>
      <div class="section-head" style="margin-top:0"><h2 style="font-size:19px">Continue following</h2><a class="link" data-nav="following">Manage <span>›</span></a></div>
      <div class="card" style="padding:8px">${following.length?following.map(e=>`
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;cursor:pointer" onclick="openProfile('${e.id}')" class="hoverable">
          ${e.icon?`<div class="inv-ava" style="width:40px;height:40px;border-radius:12px;font-size:18px;background:linear-gradient(145deg,${e.c1},${e.c2})">${e.icon}</div>`:avatarHTML(e,40,12)}
          <div style="min-width:0;flex:1"><div style="font-weight:600;font-size:14px">${esc(e.name)} ${e.inspired?'<span class="inspired-tag" style="position:static;display:inline-block">Inspired By</span>':''}</div><div style="font-size:12px;color:var(--ink-mute)">${esc(e.style||e.cat)}</div></div>
          <span class="pill pos" style="white-space:nowrap">Following</span>
        </div>`).join(''):'<div style="padding:24px;text-align:center;color:var(--ink-mute)">You are not following anyone yet. Tap the heart on any investor to follow their portfolio changes.</div>'}</div>
    </div>
  </div>
  ${disclaimer(COMPLIANCE_NOTE)}`;
}

/* AI match score for a legend/strategy against USER DNA (deterministic) */
function matchFor(e){
  if(e.match) return e.match;
  const riskMap={'Low':20,'Low-Moderate':35,'Moderate':55,'Moderate-High':68,'High':78,'Very High':90,'Extreme':98};
  const er=riskMap[e.risk]||55;
  let score=100-Math.abs(er-USER.dna.riskScore)*0.9;
  if(e.cat==='crypto'||e.cat==='Crypto')score-=14;
  if(e.shariah)score-=0; // neutral
  if((e.vol||15)>30)score-=10;
  score=Math.max(28,Math.min(96,Math.round(score)));
  e._match=score;return score;
}

/* ============================================================
   VIEW: COMMUNITY INVESTORS
   ============================================================ */
function viewCommunity(){
  const cats=['all','Balanced','Growth','Income','Crypto'];
  const sorts=[['match','AI match'],['riskAdj','Risk-adjusted'],['behaviour','Behaviour'],['divers','Diversification'],['maxDD','Lowest drawdown']];
  let list=[...COMMUNITY];
  if(App.communityFilter!=='all'&&!['sh','shariah'].includes(App.communityFilter))list=list.filter(c=>c.cat===App.communityFilter||(App.communityFilter==='Shariah'&&c.shariah));
  if(App.communityShariah)list=list.filter(c=>c.shariah);
  const sk=App.communitySort||'match';
  list.sort((a,b)=> sk==='maxDD'? b.maxDD-a.maxDD : b[sk]-a[sk]);
  const movers=[...COMMUNITY].sort((a,b)=>b.ret30-a.ret30).slice(0,3);
  const leaders=[...COMMUNITY].sort((a,b)=>b.riskAdj-a.riskAdj).slice(0,3);
  return `
  <div class="section-head" style="margin-top:6px"><h2>Community Investors</h2><div class="sub">Anonymised Vault22 investors, ranked on risk-adjusted quality.</div></div>
  ${disclaimer('Community profiles are anonymised and shown with consent. We deliberately rank on risk-adjusted and behavioural quality so a lucky high-risk run never tops the board. Not advice.')}
  <div class="grid cols-2" style="margin:18px 0">
    <div class="card card-sheen">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:4px"><b>Monthly leaderboard</b><span class="pill gold" style="margin-left:auto">Resets 1 Aug 2026</span></div>
      <div style="font-size:12px;color:var(--ink-mute);margin-bottom:12px">This month's biggest movers by 30-day return. Movers, not recommendations. The all-time board below is what we judge on.</div>
      ${movers.map((c,i)=>`<div style="display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer" class="hoverable" onclick="openProfile('${c.id}')">
        <span style="font-weight:800;color:var(--ink-mute);width:18px">${i+1}</span>${avatarHTML(c,34,10)}
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13.5px">${esc(c.name)}</div><div style="font-size:11.5px;color:var(--ink-mute)">${esc(c.style)}</div></div>
        <span class="pill ${c.ret30>=0?'pos':'neg'}">${fmt(c.ret30)} 30D</span></div>`).join('')}
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:4px"><b>All-time leaders</b><span class="pill" style="margin-left:auto">Risk-adjusted</span></div>
      <div style="font-size:12px;color:var(--ink-mute);margin-bottom:12px">Long-term rankings stay prominent through the monthly reset, so a single hot month never crowns a winner.</div>
      ${leaders.map((c)=>`<div style="display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer" class="hoverable" onclick="openProfile('${c.id}')">
        <span style="font-weight:800;color:var(--teal-deep);width:26px">#${allTimeRank(c.id)}</span>${avatarHTML(c,34,10)}
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13.5px">${esc(c.name)}</div><div style="font-size:11.5px;color:var(--ink-mute)">${esc(c.style)}</div></div>
        <span class="pill pos">${c.riskAdj.toFixed(2)} risk-adj</span></div>`).join('')}
    </div>
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:18px 0">
    <div class="chip-row">${cats.map(c=>`<button class="chip ${App.communityFilter===c?'on':''}" onclick="App.communityFilter='${c}';App.render()">${c==='all'?'All':c}</button>`).join('')}</div>
    <button class="chip ${App.communityShariah?'on':''}" onclick="App.communityShariah=!App.communityShariah;App.render()">☪ Shariah only</button>
    <div style="margin-left:auto;display:flex;align-items:center;gap:8px"><span style="font-size:12.5px;color:var(--ink-mute)">Sort by</span>
      <div class="chip-row">${sorts.map(s=>`<button class="chip ${sk===s[0]?'on':''}" onclick="App.communitySort='${s[0]}';App.render()">${s[1]}</button>`).join('')}</div></div>
  </div>
  <div class="card" style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>The efficient frontier</b><span style="font-size:12px;color:var(--ink-mute)">Risk vs return · you in gold</span></div>
    ${scatterPlot([...list.map(c=>({x:c.vol,y:c.ret3y,label:c.name,cat:c.cat})),{x:USER.risk.vol,y:9.5,label:'Your portfolio',me:true}])}</div>
  <div class="grid auto-wide">${list.map(communityCard).join('')}</div>
  ${list.length?'':'<div class="card" style="text-align:center;padding:40px;color:var(--ink-mute)">No investors match these filters.</div>'}
  ${disclaimer(COMPLIANCE_NOTE)}`;
}

/* ============================================================
   VIEW: MARKET LEGENDS (searchable library)
   ============================================================ */
function viewLegends(){
  const tabs=[['all','All'],['tradfi','TradFi'],['crypto','Crypto'],['shariah','Shariah'],['low','Lowest volatility']];
  let list=[...ALL_LEGENDS];
  const f=App.legendFilter;
  if(f==='tradfi')list=list.filter(l=>l.cat==='tradfi');
  else if(f==='crypto')list=list.filter(l=>l.cat==='crypto');
  else if(f==='shariah')list=list.filter(l=>l.shariah);
  else if(f==='low')list=list.sort((a,b)=>a.vol-b.vol);
  const q=(App.legendSearch||'').toLowerCase();
  if(q)list=list.filter(l=>(l.name+l.style+(l.by||'')+l.sectors.join(' ')).toLowerCase().includes(q));
  const tradfi=list.filter(l=>l.cat==='tradfi'),crypto=list.filter(l=>l.cat==='crypto');
  const section=(title,arr)=> arr.length?`<div class="section-head"><h2 style="font-size:20px">${title}</h2><div class="sub">${arr.length} model styles</div></div><div class="grid auto-cards">${arr.map(legendCard).join('')}</div>`:'';
  return `
  <div class="section-head" style="margin-top:6px"><h2>Market Legends</h2><div class="sub">Model portfolios inspired by proven styles. Study, verify the source, build your own.</div></div>
  ${disclaimer('Every legend here is an <b>Inspired By</b> educational model showing similar exposure to a well-known style. None is an official portfolio of the named investor. Sources for real disclosed holdings are cited inside each profile.')}
  <div style="margin-top:18px">${collectionsRail()}</div>
  <div class="search" style="max-width:none;margin:16px 0">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <input placeholder="Search legends, styles or sectors (e.g. value, Bitcoin, dividend)" value="${esc(App.legendSearch||'')}" oninput="App.legendSearch=this.value;App.render();setTimeout(()=>{const i=document.querySelector('.view .search input');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},0)">
  </div>
  <div class="chip-row" style="margin-bottom:8px">${tabs.map(t=>`<button class="chip ${f===t[0]?'on':''}" onclick="App.legendFilter='${t[0]}';App.render()">${t[1]}</button>`).join('')}</div>
  ${f==='low'?`<div class="grid auto-cards">${list.map(legendCard).join('')}</div>`:section('TradFi styles',tradfi)+section('Crypto styles',crypto)}
  ${list.length?'':'<div class="card" style="text-align:center;padding:40px;color:var(--ink-mute)">No legends match your search.</div>'}
  ${disclaimer(COMPLIANCE_NOTE)}`;
}

/* ============================================================
   VIEW: INVESTMENT STRATEGIES
   ============================================================ */
function viewStrategies(){
  const cats=['all','Growth','Income','Balanced','Defensive','Crypto'];
  let list=[...STRATEGIES];
  if(App.strategyFilter!=='all')list=list.filter(s=>s.cat===App.strategyFilter);
  return `
  <div class="section-head" style="margin-top:6px"><h2>Investment Strategies</h2><div class="sub">Goal-based model portfolios, independent of any famous investor. Pick an outcome, not a personality.</div></div>
  ${disclaimer('Strategies are educational model portfolios and AI-generated allocations showing similar exposure to a theme. Not advice, and target returns are illustrative, not guaranteed. Capital is at risk.')}
  <div class="chip-row" style="margin:18px 0">${cats.map(c=>`<button class="chip ${App.strategyFilter===c?'on':''}" onclick="App.strategyFilter='${c}';App.render()">${c==='all'?'All':c}</button>`).join('')}</div>
  <div class="grid auto-cards">${list.map(strategyCard).join('')}</div>
  ${disclaimer(COMPLIANCE_NOTE)}`;
}

/* ============================================================
   VIEW: COMPARE (full page)
   ============================================================ */
function viewCompare(){
  const id=App.compareId||[...COMMUNITY].sort((a,b)=>b.match-a.match)[0].id;
  App.compareId=id;
  const e=findEntity(id);
  const picks=[...COMMUNITY].sort((a,b)=>b.match-a.match).slice(0,6).concat(ALL_LEGENDS.filter(l=>['buffett','dalio','bogle','wood','saylor'].includes(l.id)));
  return `
  <div class="section-head" style="margin-top:6px"><h2>Compare</h2><div class="sub">See your portfolio side by side with any investor or legend, with Tara's suggested improvements.</div></div>
  <div class="card" style="margin-bottom:18px">
    <div style="font-size:12.5px;color:var(--ink-mute);margin-bottom:10px">Compare your portfolio against</div>
    <div class="chip-row">${picks.map(p=>`<button class="chip ${p.id===id?'on':''}" onclick="App.compareId='${p.id}';App.render()">${p.icon?p.icon+' ':''}${esc(p.name)}</button>`).join('')}</div>
  </div>
  ${compareBody(e)}
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
    <button class="btn btn-primary" onclick="openBuild('${id}')">Build a version that suits me</button>
    <button class="btn btn-ghost" onclick="openProfile('${id}')">View full profile</button>
  </div>`;
}

/* ============================================================
   VIEW: FOLLOWING
   ============================================================ */
function viewFollowing(){
  const list=[...Follow.set].map(findEntity).filter(Boolean);
  const saved=Personal.saved.map(findEntity).filter(Boolean);
  const earned=BADGES.filter(b=>b.earned).length;
  return `
  <div class="section-head" style="margin-top:6px"><h2>Following</h2><div class="sub">Portfolios you watch. We notify you when their allocation changes, so you can learn from real decisions.</div></div>
  ${list.length? `<div class="grid auto-wide">${list.map(e=> e.community?communityCard(e): e.strategy?strategyCard(e): legendCard(e)).join('')}</div>`
    : `<div class="card" style="text-align:center;padding:56px 24px"><div class="coach-illus" style="margin-bottom:16px">🔭</div><h3 style="margin-bottom:8px">Nothing followed yet</h3><p style="color:var(--ink-mute);max-width:420px;margin:0 auto 18px">Follow community investors, legends or strategies to track how they evolve. Watchlist mode lets you learn before you invest.</p><button class="btn btn-primary" data-nav="legends">Browse Market Legends</button></div>`}

  ${saved.length?`<div class="section-head"><h2 style="font-size:19px">Saved comparisons</h2><div class="sub">Pick up where you left off</div></div>
  <div class="card" style="padding:8px">${saved.map(e=>`<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;cursor:pointer" onclick="openCompare('${e.id}')" class="hoverable">${e.icon?`<div class="inv-ava" style="width:40px;height:40px;border-radius:12px;font-size:18px;background:linear-gradient(145deg,${e.c1},${e.c2})">${e.icon}</div>`:avatarHTML(e,40,12)}<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">You vs ${esc(e.name)}</div><div style="font-size:12px;color:var(--ink-mute)">${esc(e.style||e.cat)}</div></div><span style="color:var(--ink-mute)">›</span></div>`).join('')}</div>`:''}

  <div class="section-head"><h2 style="font-size:19px">Your milestones</h2><div class="sub">${earned} of ${BADGES.length} earned · we reward long-term investing, not trading</div></div>
  <div class="grid cols-3">${BADGES.map(b=>`<div class="badge-tile ${b.earned?'':'locked'}"><div class="badge-ic">${b.i}</div><div style="min-width:0"><div class="bt">${esc(b.t)}</div><div class="bd">${b.earned?esc(b.d):(b.prog?'In progress · '+esc(b.prog):esc(b.d))}</div></div>${b.earned?'<span class="pill pos" style="margin-left:auto">✓</span>':''}</div>`).join('')}</div>
  ${list.length||saved.length?disclaimer(COMPLIANCE_NOTE):''}`;
}

/* ============================================================
   VIEW: SEARCH (global)
   ============================================================ */
function viewSearch(){
  const q=App.query.toLowerCase();
  const inMatch=(e,extra='')=>(e.name+' '+(e.style||'')+' '+(e.by||'')+' '+(e.cat||'')+' '+extra).toLowerCase().includes(q);
  const legends=ALL_LEGENDS.filter(e=>inMatch(e,e.sectors.join(' ')));
  const comm=COMMUNITY.filter(e=>inMatch(e));
  const strat=STRATEGIES.filter(e=>inMatch(e,e.explain));
  const block=(t,arr,fn)=>arr.length?`<div class="section-head"><h2 style="font-size:19px">${t}</h2><div class="sub">${arr.length} result${arr.length>1?'s':''}</div></div><div class="grid auto-cards">${arr.map(fn).join('')}</div>`:'';
  const total=legends.length+comm.length+strat.length;
  return `<div class="section-head" style="margin-top:6px"><h2>Results for "${esc(App.query)}"</h2><div class="sub">${total} match${total===1?'':'es'} across the leaderboard</div></div>
    ${total?block('Market Legends',legends,legendCard)+block('Community Investors',comm,communityCard)+block('Strategies',strat,strategyCard)
      :`<div class="card" style="text-align:center;padding:48px;color:var(--ink-mute)">No matches. Try "value", "dividend", "Bitcoin", "Shariah" or "low volatility".</div>`}`;
}

/* ============================================================
   OVERLAYS: scrim + modal + tara
   ============================================================ */
function openModal(html){$('#modalInner').innerHTML=html;$('#scrim').classList.add('show');$('#modal').classList.add('show');$('#modal').scrollTop=0;document.body.style.overflow='hidden';}
function closeAll(){$('#scrim').classList.remove('show');$('#modal').classList.remove('show');$('#taraPanel').classList.remove('show');document.body.style.overflow='';}

/* ---------- PROFILE screen ---------- */
function openProfile(id){
  const e=findEntity(id);if(!e)return;
  Personal.view(id);
  const up=(e.ret3y||10)>=0;const seed=hashSeed(id);
  const isComm=e.community;const isStrat=e.strategy;
  const riskLabel=(typeof e.risk==='string')?e.risk:(e.riskLbl||'Moderate');
  const followed=Follow.has(id);
  const alloc=e.alloc||e.allocation||[];
  const holdings=e.holdings||[];
  const head=`<div class="modal-head">
    ${e.icon?`<div class="inv-ava" style="width:44px;height:44px;font-size:20px;background:linear-gradient(145deg,${e.c1},${e.c2})">${e.icon}</div>`:avatarHTML(e,44,13)}
    <div style="flex:1;min-width:0"><h3>${esc(e.name)} ${e.shariah?'<span class="pill shariah">Shariah</span>':''}</h3>
      <div style="font-size:12.5px;color:var(--ink-mute)">${esc(e.style||e.cat)}${e.by?' · '+esc(e.by):''}${e.inspired?' · Inspired By (educational)':''}</div></div>
    <button class="close-x" onclick="closeAll()"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
  </div>`;

  // hero band
  const heroStats = isStrat
    ? [['Typical return*',e.ret.replace(' target',''),null],['Expected risk',riskLabel,null],['Volatility',e.vol+'%','Volatility'],['Worst drawdown',e.maxDD+'%','Max drawdown'],['Min horizon',e.horizon,null]]
    : [['3Y return*',fmt(e.ret3y),null],['Risk-adjusted',(e.riskAdj||0).toFixed(2),'Risk-adjusted return'],['Worst drawdown',e.maxDD+'%','Max drawdown'],['Volatility',e.vol+'%','Volatility'],['Min horizon',e.horizon||e.hold||'5+ yrs',null]];

  const match = isStrat? matchFor(e) : (e.match||matchFor(e));
  const hero=`<div class="hero" style="margin-bottom:20px;padding:24px">
    <div class="hero-inner" style="max-width:none">
      <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center">
        <div style="text-align:center">${matchRing(match)}<div style="font-size:11px;color:var(--ink-mute);margin-top:6px">AI match <span class="help" data-tip="AI Match %">i</span></div></div>
        <div style="flex:1;min-width:220px;display:flex;gap:22px;flex-wrap:wrap">
          ${heroStats.map(s=>`<div class="metric"><span class="k">${s[0]} ${s[2]?`<span class="help" data-tip="${s[2]}">i</span>`:''}</span><span class="val" style="font-size:19px">${s[1]}</span></div>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:18px">
        <span class="pill">${riskDots(riskLabel)} ${esc(riskLabel)} risk</span>
        ${e.hold?`<span class="pill">Holds ${esc(e.hold)}</span>`:''}
        ${e.behaviour?`<span class="pill">Behaviour ${e.behaviour}/100 <span class="help" data-tip="Behaviour Score">i</span></span>`:''}
        ${e.divers?`<span class="pill">Diversification ${e.divers}/100</span>`:''}
        ${isComm?`<span class="pill">${e.followers.toLocaleString()} followers</span><span class="pill">${e.watchers.toLocaleString()} watching</span>`:''}
        ${e.badge?`<span class="pill gold">🏅 ${esc(e.badge)}</span>`:''}
      </div>
    </div>
  </div>`;

  const bio = e.bio||e.explain||'';
  const philosophy=e.philosophy||'';
  const perf=`<div class="card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>Performance history</b><span class="why" onclick="TFloat.show('<b>Why illustrative?</b> We show the shape of a style, not a promise. Real returns depend on entry timing, fees and markets. Past performance never guarantees future results.','')">Why illustrative?</span></div>${perfInteractive('perf-'+id,seed,up)}</div>`;

  const fee=estFee(e);
  const returnsCard = isStrat?'' : `<div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>Returns and fees</b><span class="pill">Net and gross shown</span></div>
    ${(e.ret30!=null||e.ret1y!=null)?retRow(e):''}
    <div class="grid cols-3" style="gap:14px;margin-top:12px">
      ${metric('3Y return, gross*', fmt(e.ret3y))}
      ${metric('Est. fee / yr', fee.toFixed(2)+'%')}
      ${metric('3Y return, net of fees*', fmt(netRet(e)))}
    </div>
    <div style="font-size:11.5px;color:var(--ink-mute);margin-top:10px;line-height:1.5">Figures are illustrative and shown both gross and net of an estimated ${fee.toFixed(2)}% annual fee. Net deducts fees, gross does not. Neither is a forecast or a track record. Capital is at risk.</div>
  </div>`;

  // grids
  const geo=e.geo, mcap=e.mcap, sectors=e.sectors&&e.sectors[0]&&e.sectors[0].k?e.sectors:null;

  const allocCard = alloc.length?`<div class="card"><b style="display:block;margin-bottom:14px">Asset allocation</b>${pieBlock(alloc,120)}</div>`:'';
  const holdCard = holdings.length?`<div class="card"><b style="display:block;margin-bottom:14px">Portfolio breakdown</b>${hbars(holdings)}${e.src?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:11.5px;color:var(--ink-mute)"><b style="color:var(--ink-soft)">Source:</b> ${esc(e.src)}</div>`:''}</div>`:'';
  const sectorCard = sectors?`<div class="card"><b style="display:block;margin-bottom:14px">Sector allocation</b>${hbars(sectors)}</div>`: (Array.isArray(e.sectors)&&!isComm?`<div class="card"><b style="display:block;margin-bottom:10px">Top sectors</b><div class="chip-row">${e.sectors.map(s=>`<span class="pill">${esc(s)}</span>`).join('')}</div></div>`:'');
  const geoCard = geo?`<div class="card"><b style="display:block;margin-bottom:14px">Geographic allocation</b>${hbars(geo)}</div>`:'';
  const mcapCard = mcap?`<div class="card"><b style="display:block;margin-bottom:14px">Market-cap distribution</b>${hbars(mcap)}</div>`:'';
  // Community investors keep their risk metrics in e.risk (object); legends keep e.risk as a string label.
  const metricsObj = (e.risk && typeof e.risk==='object')? e.risk : null;
  const riskCard = metricsObj?`<div class="card"><b style="display:block;margin-bottom:14px">Risk metrics</b>
    <div class="grid cols-2" style="gap:14px">
      ${metric('Sharpe ratio',metricsObj.sharpe.toFixed(2),'Sharpe Ratio')}
      ${metric('Volatility',metricsObj.vol+'%','Volatility')}
      ${metric('Max drawdown',metricsObj.maxDD+'%','Max drawdown')}
      ${metric('Beta vs market','' +metricsObj.beta,null)}
    </div></div>`:'';

  const timeline = e.timeline?`<div class="card" style="margin-top:16px"><b style="display:block;margin-bottom:16px">Timeline of major portfolio changes</b>
    <div style="display:flex;flex-direction:column;gap:0">${e.timeline.map((t,i)=>`
      <div style="display:flex;gap:14px"><div style="display:flex;flex-direction:column;align-items:center"><span style="width:11px;height:11px;border-radius:50%;background:var(--teal);margin-top:5px;box-shadow:0 0 0 4px rgba(220,0,50,.15)"></span>${i<e.timeline.length-1?'<span style="flex:1;width:2px;background:var(--line)"></span>':''}</div>
      <div style="padding-bottom:${i<e.timeline.length-1?'18px':'0'}"><div style="font-size:12px;color:var(--teal);font-weight:600">${esc(t[0])}</div><div style="font-size:13.5px;color:var(--ink-soft)">${esc(t[1])}</div></div></div>`).join('')}</div></div>`:'';

  const recent = e.changes?`<div class="card" style="margin-top:16px"><b style="display:block;margin-bottom:12px">Recent changes</b>${e.changes.map(c=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line);font-size:13.5px"><span>${esc(c[0])}</span><span style="color:var(--ink-mute)">${esc(c[1])}</span></div>`).join('')}</div>`:'';

  const suit = (e.suit||e.avoid)?`<div class="grid cols-2" style="margin-top:16px">
    ${e.suit?`<div class="card" style="border-color:rgba(220,0,50,.22)"><b style="display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#6ee7b7">✓ Who this suits</b><div style="font-size:13.5px;color:var(--ink-soft)">${esc(e.suit)}</div></div>`:''}
    ${e.avoid?`<div class="card" style="border-color:rgba(251,113,133,.22)"><b style="display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#fda4af">✕ Who should avoid it</b><div style="font-size:13.5px;color:var(--ink-soft)">${esc(e.avoid)}</div></div>`:''}
  </div>`:'';

  const hist=e.hist?`<div class="card" style="margin-top:16px"><b style="display:block;margin-bottom:8px">Historical characteristics</b><div style="font-size:13.5px;color:var(--ink-soft)">${esc(e.hist)}</div></div>`:'';

  const taraCard=`<div class="card" style="margin-top:16px;background:linear-gradient(120deg,rgba(124,108,255,.14),rgba(79,195,247,.06));border-color:rgba(124,108,255,.3)">
    <div style="display:flex;gap:12px"><span class="tara-orb" style="width:30px;height:30px;flex:none"></span>
    <div><div class="h" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6C5CE7;font-weight:700;margin-bottom:6px">Tara's take</div>
    <div style="font-size:14px;line-height:1.55;color:#2E2A5B">${esc(e.tara|| (e.summary)||'This style is one to study before you adopt it.')}</div>
    <button class="btn btn-tara btn-sm" style="margin-top:12px" onclick="Tara.suit('${id}')">Ask Tara if it suits me</button></div></div></div>`;

  const behaviourInsights = isComm?`<div class="card" style="margin-top:16px"><b style="display:block;margin-bottom:10px">Behaviour insights</b>
    <div class="grid cols-2" style="gap:12px">
      ${[['Stayed invested in last correction',e.behaviour>85],['Regular monthly contributions',e.years>=6],['Avoided panic selling',e.behaviour>75],['Rebalances on schedule',e.divers>80]].map(b=>`<div style="display:flex;align-items:center;gap:9px;font-size:13px"><span style="color:${b[1]?'#34D399':'#7E93A5'}">${b[1]?'✓':'·'}</span>${b[0]}</div>`).join('')}
    </div></div>`:'';

  const body=`<div class="modal-body">
    ${hero}
    ${bio?`<div class="card" style="margin-bottom:16px"><b style="display:block;margin-bottom:8px">${isComm?'AI-generated summary':'Biography'}</b><div style="font-size:14px;color:var(--ink-soft);line-height:1.6">${esc(bio)}</div></div>`:''}
    ${isComm&&e.summary?`<div class="card" style="margin-bottom:16px;background:linear-gradient(120deg,rgba(124,108,255,.12),transparent);border-color:rgba(124,108,255,.25)"><div class="h" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6C5CE7;font-weight:700;margin-bottom:6px">AI summary</div><div style="font-size:14px;color:#2E2A5B;line-height:1.6">${esc(e.summary)}</div></div>`:''}
    ${philosophy?`<div class="card" style="margin-bottom:16px"><b style="display:block;margin-bottom:8px">Investment philosophy</b><div style="font-size:14px;color:var(--ink-soft);line-height:1.6">${esc(philosophy)}</div></div>`:''}
    ${perf}
    ${returnsCard}
    <div class="grid cols-2">${allocCard}${holdCard}</div>
    <div class="grid cols-2" style="margin-top:16px">${sectorCard}${geoCard}</div>
    <div class="grid cols-2" style="margin-top:16px">${mcapCard}${riskCard}</div>
    ${hist}
    ${suit}
    ${behaviourInsights}
    ${timeline}
    ${recent}
    ${taraCard}
    ${disclaimer(COMPLIANCE_NOTE)}
    <div style="display:flex;gap:10px;flex-wrap:wrap;position:sticky;bottom:0;background:linear-gradient(180deg,transparent,rgba(255,255,255,.98) 40%);padding:16px 0 4px;margin-top:8px">
      <button class="btn btn-primary" style="flex:1;min-width:160px" onclick="openBuild('${id}')">Build Similar Portfolio</button>
      ${!isStrat?`<button class="btn btn-ghost" onclick="openCompare('${id}',1)">Compare With Me</button>`:''}
      <button class="btn btn-ghost" onclick="Follow.toggle('${id}','${esc(e.name)}');refreshFollowBtn('${id}')" id="followBtn"><span id="followTxt">${followed?'♥ Following':'♡ Follow updates'}</span></button>
    </div>
  </div>`;
  openModal(head+body);
}
function refreshFollowBtn(id){const t=$('#followTxt');if(t)t.textContent=Follow.has(id)?'♥ Following':'♡ Follow updates';}

/* ---------- COMPARE ---------- */
function openCompare(id,back){
  if(!id){ // picker
    openModal(`<div class="modal-head"><h3>Compare with an investor</h3><button class="close-x" onclick="closeAll()"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      <div class="modal-body"><p style="color:var(--ink-soft);margin-top:0">Choose an investor or legend to compare against your portfolio.</p>
      <div class="section-head" style="margin-top:8px"><h2 style="font-size:16px">Best matches</h2></div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">${[...COMMUNITY].sort((a,b)=>b.match-a.match).slice(0,4).concat(ALL_LEGENDS.filter(l=>['buffett','dalio','bogle','saylor'].includes(l.id))).map(e=>`
        <button class="badge-tile" style="cursor:pointer;text-align:left" onclick="openCompare('${e.id}')">${e.icon?`<div class="badge-ic">${e.icon}</div>`:`<div class="badge-ic" style="background:linear-gradient(145deg,${e.c1},${e.c2});color:#04121d;font-weight:800">${esc(e.initials)}</div>`}<div><div class="bt">${esc(e.name)}</div><div class="bd">${esc(styleOf(e))}</div></div></button>`).join('')}</div></div>`);
    return;
  }
  const e=findEntity(id);if(!e)return;
  const backBtn = back?`<button class="close-x" aria-label="Back to profile" onclick="openProfile('${id}')"><svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:'';
  const head=`<div class="modal-head">${backBtn}<h3>Compare</h3><button class="close-x" onclick="closeAll()"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>`;
  const body=`<div class="modal-body">${compareBody(e)}
    <div style="position:sticky;bottom:0;background:linear-gradient(180deg,transparent,rgba(255,255,255,.98) 40%);padding:16px 0 4px;display:flex;gap:10px">
      <button class="btn btn-primary" style="flex:1" onclick="openBuild('${id}')">Build a version that suits me</button>
    </div></div>`;
  openModal(head+body);
}
/* shared comparison markup (used in modal + Compare view) */
function compareBody(e){
  const u=USER;const ua=u.allocation, ea=e.alloc||e.allocation||[];
  const overlap=e.overlap|| computeOverlap(ua,ea);
  const em = (e.risk&&typeof e.risk==='object')?e.risk:{sharpe:e.riskAdj||0.8,vol:e.vol,maxDD:e.maxDD,beta:1};
  const suggestions=compareSuggestions(e,overlap);
  const row=(label,you,them,key,youBetter)=>`<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)">
    <div style="text-align:right;font-weight:700;font-size:15px;color:${youBetter===true?'#34D399':'inherit'}">${you}</div>
    <div style="text-align:center;min-width:118px"><div style="font-size:11.5px;color:var(--ink-mute)">${esc(label)} ${key?`<span class="help" data-tip="${key}">i</span>`:''}</div></div>
    <div style="font-weight:700;font-size:15px;color:${youBetter===false?'#34D399':'inherit'}">${them}</div></div>`;
  // radar values 0-100: Return, Low risk, Diversification, Consistency, Behaviour
  const axes=['Return','Low risk','Diversification','Consistency','Behaviour'];
  const uR=[Math.min(100,9.5*7),100-u.dna.riskScore,u.dna.diversification,u.dna.consistency,u.dna.behaviour];
  const eR=[Math.min(100,Math.max(6,(e.ret3y||8)*6)),100-riskScoreOf(e),e.divers||70,e.consistency||70,e.behaviour||70];
  // biggest differences by asset bucket
  const ub={};ua.forEach(x=>ub[bucket(x.k)]=(ub[bucket(x.k)]||0)+x.v);const eb={};ea.forEach(x=>eb[bucket(x.k)]=(eb[bucket(x.k)]||0)+x.v);
  const diffs=[...new Set([...Object.keys(ub),...Object.keys(eb)])].map(k=>({k,d:(eb[k]||0)-(ub[k]||0)})).filter(x=>Math.abs(x.d)>=4).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,4);
  const ranked=suggestions.map((s,i)=>({s,impact:i===0?'High':i===1?'Medium':'Low'}));
  return `
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;margin-bottom:18px">
      <div style="text-align:right"><div class="avatar" style="margin-left:auto;width:48px;height:48px">AA</div><div style="font-weight:700;margin-top:6px">You</div><div style="font-size:12px;color:var(--ink-mute)">${esc(u.dna.style)}</div></div>
      <div style="font-size:13px;color:var(--ink-mute);font-weight:700">VS</div>
      <div>${e.icon?`<div class="inv-ava" style="width:48px;height:48px;font-size:22px;background:linear-gradient(145deg,${e.c1},${e.c2})">${e.icon}</div>`:avatarHTML(e,48,14)}<div style="font-weight:700;margin-top:6px">${esc(e.name)}</div><div style="font-size:12px;color:var(--ink-mute)">${esc(styleOf(e))}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px;background:linear-gradient(120deg,rgba(124,108,255,.12),transparent);border-color:rgba(124,108,255,.25)">
      <div style="display:flex;gap:9px;align-items:center;margin-bottom:8px"><span class="tara-orb" style="width:24px;height:24px"></span><b>AI-generated comparison</b></div>
      <p style="font-size:14px;color:#2E2A5B;line-height:1.6;margin:0">${esc(compareSummary(e,overlap))}</p>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><b style="display:block;margin-bottom:8px">Profile radar</b><div style="font-size:11.5px;color:var(--ink-mute);margin-bottom:6px"><span style="color:#95052A">● You</span> &nbsp; <span style="color:#6C5CE7">● ${esc(e.name.split(' ')[0])}</span></div>${radar(axes,uR.map(v=>Math.min(100,v)),eR.map(v=>Math.min(100,v)))}</div>
      <div class="card" style="text-align:center;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:12px;color:var(--ink-mute)">Portfolio overlap <span class="help" data-tip="Portfolio Overlap">i</span></div>
        <div style="font-size:44px;font-weight:800;color:var(--teal);line-height:1.1">${overlap}%</div>
        <div style="font-size:12.5px;color:var(--ink-soft);max-width:240px;margin:6px auto 0">${overlap>65?'High overlap. Adopting this style is a small tilt, not a rebuild.':overlap>40?'Moderate overlap. Some meaningful changes to adopt this style.':'Low overlap. This would be a significant change to your portfolio.'}</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px"><b style="display:block;margin-bottom:12px">Asset class overlap</b>${overlapViz(u,e)}</div>
    <div class="card" style="margin-bottom:16px">
      ${row('Risk score', u.dna.riskScore, riskScoreOf(e),'Risk-adjusted return', u.dna.riskScore<riskScoreOf(e))}
      ${row('Risk-adjusted', em.sharpe.toFixed(2), (e.riskAdj||em.sharpe).toFixed(2),'Sharpe Ratio', em.sharpe>(e.riskAdj||em.sharpe))}
      ${row('Volatility', u.risk.vol+'%', (e.vol||em.vol)+'%','Volatility', u.risk.vol<(e.vol||em.vol))}
      ${row('Worst drawdown', u.risk.maxDD+'%', e.maxDD+'%','Max drawdown', u.risk.maxDD>e.maxDD)}
      ${row('Diversification', u.dna.diversification, e.divers||'n/a','Diversification Score', e.divers?u.dna.diversification>e.divers:null)}
    </div>
    ${diffs.length?`<div class="card" style="margin-bottom:16px"><b style="display:block;margin-bottom:12px">Biggest differences</b>
      <div class="grid cols-2" style="gap:10px">${diffs.map(x=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--glass)"><span style="font-size:20px">${x.d>0?'▲':'▼'}</span><div style="flex:1"><div style="font-weight:600;font-size:13.5px">${esc(x.k)}</div><div style="font-size:11.5px;color:var(--ink-mute)">${x.d>0?e.name.split(' ')[0]+' holds '+Math.abs(x.d)+'% more':'You hold '+Math.abs(x.d)+'% more'}</div></div><span class="pill ${x.d>0?'violet':'shariah'}">${x.d>0?'+':''}${x.d}%</span></div>`).join('')}</div></div>`:''}
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><b style="display:block;margin-bottom:12px">Your sector exposure</b>${hbars(u.sectors)}</div>
      <div class="card"><b style="display:block;margin-bottom:12px">${esc(e.name.split(' ')[0])}'s sectors</b>${e.sectors&&e.sectors[0].k?hbars(e.sectors):`<div class="chip-row">${(e.sectors||[]).map(s=>`<span class="pill">${esc(s.k||s)}</span>`).join('')}</div>`}</div>
    </div>
    <div class="grid cols-2" style="margin-bottom:16px">
      <div class="card"><b style="display:block;margin-bottom:12px">Your geography</b>${hbars(u.geo)}</div>
      <div class="card"><b style="display:block;margin-bottom:12px">${esc(e.name.split(' ')[0])}'s geography</b>${e.geo?hbars(e.geo):'<div style="color:var(--ink-mute);font-size:13px">Not disclosed for this style</div>'}</div>
    </div>
    <div class="card" style="background:linear-gradient(120deg,rgba(124,108,255,.14),transparent);border-color:rgba(124,108,255,.3)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><span class="tara-orb" style="width:26px;height:26px;flex:none"></span><b style="flex:1">Suggested actions, ranked by impact</b><button class="btn btn-ghost btn-sm" onclick="Personal.saveComparison('${e.id}')">♡ Save comparison</button></div>
      ${ranked.map(r=>`<div style="display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--line)"><span class="pill ${r.impact==='High'?'pos':r.impact==='Medium'?'gold':''}" style="min-width:70px;justify-content:center">${r.impact}</span><span style="flex:1;font-size:13.5px;color:#2E2A5B;line-height:1.55">${esc(r.s)}</span></div>`).join('')}
    </div>
    ${disclaimer(COMPLIANCE_NOTE)}`;
}
function compareSummary(e,overlap){
  const er=riskScoreOf(e),diff=er-USER.dna.riskScore;
  return `Compared with your ${USER.dna.style} profile, ${e.name} is ${diff>12?'notably more aggressive':diff<-12?'more defensive':'similarly positioned on risk'}, with ${overlap}% of your holdings in common. ${(e.divers||70)>USER.dna.diversification?'They are better diversified than you, which is the clearest thing to learn from here.':'You are at least as diversified as them.'} ${e.cat==='crypto'?'As a crypto style, treat any adoption as a small satellite.':'The gap is a tilt you could phase in gradually rather than all at once.'}`;
}
function computeOverlap(a,b){let s=0;const bm={};b.forEach(x=>bm[x.k]=x.v);a.forEach(x=>{if(bm[x.k])s+=Math.min(x.v,bm[x.k]);});return Math.round(s);}
function riskScoreOf(e){const m={'Low':20,'Low-Moderate':35,'Moderate':55,'Moderate-High':68,'High':78,'Very High':90,'Extreme':98};return m[(typeof e.risk==='string')?e.risk:(e.riskLbl||'Moderate')]||55;}
function compareSuggestions(e,overlap){
  const out=[];const er=riskScoreOf(e);
  if(er>USER.dna.riskScore+15)out.push('This style takes more risk than your DNA suggests. If you build a version, start with the Conservative tilt to bring volatility back toward your comfort zone.');
  else if(er<USER.dna.riskScore-15)out.push('This style is more defensive than you. It could steady your portfolio, at the cost of some growth.');
  else out.push('Risk levels are well aligned, so this is a natural fit to learn from.');
  if((e.divers||70)>USER.dna.diversification)out.push('Their diversification score is higher than yours. Widening your geographic and asset mix toward theirs would lift your own score.');
  if(overlap<50)out.push('Overlap is low, so adopting this fully means large changes and possible fees or tax. Consider phasing in with monthly contributions.');
  if((e.cat==='crypto'))out.push('This is a crypto style. Keep any allocation within a small satellite sleeve rather than your core.');
  out.push('Remember: strong recent numbers are not a reason to chase. Judge fit and risk first, returns second.');
  return out.slice(0,4);
}

/* ---------- BUILD SIMILAR (3-step flow) ---------- */
const Build={
  id:null,step:1,amount:5000,monthly:200,horizon:10,risk:'Original',shariah:false,esg:false,income:false,
  open(id){const e=findEntity(id);if(!e)return;this.id=id;this.step=1;this.amount=5000;this.monthly=200;this.horizon=10;this.risk='Original';this.shariah=!!e.shariah;this.esg=!!e.esg;this.income=false;this.render();},
  render(){
    const e=findEntity(this.id);const s=this.step;const steps=['Plan','Adjust','Preview'];
    const head=`<div class="modal-head">
      ${e.icon?`<div class="inv-ava" style="width:40px;height:40px;font-size:19px;background:linear-gradient(145deg,${e.c1},${e.c2})">${e.icon}</div>`:avatarHTML(e,40,12)}
      <div style="flex:1;min-width:0"><h3 style="font-size:16px">Build a portfolio inspired by ${esc(e.name)}</h3><div style="font-size:12px;color:var(--ink-mute)">Your version · educational model · not advice</div></div>
      <button class="close-x" aria-label="Close" onclick="closeAll()"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>`;
    const stepper=`<div class="steps">${steps.map((t,i)=>`<div class="st ${s===i+1?'on':s>i+1?'done':''}"><div class="n">${s>i+1?'✓':i+1}</div><div class="l">${t}</div></div>`).join('')}</div>`;
    let inner = s===1?this.stepPlan(e) : s===2?this.stepAdjust(e) : this.preview(e);
    const nav=`<div style="display:flex;gap:10px;margin-top:24px;position:sticky;bottom:0;background:linear-gradient(180deg,transparent,rgba(255,255,255,.98) 40%);padding:14px 0 4px">
      ${s>1?`<button class="btn btn-ghost" onclick="Build.step--;Build.render()">Back</button>`:''}
      ${s<3?`<button class="btn btn-primary" style="flex:1" onclick="Build.step++;Build.render()">${s===1?'Adjust risk':'Preview portfolio'}</button>`
        :`<button class="btn btn-primary" style="flex:1" onclick="Build.commit('plan')">Add to My Plan</button><button class="btn btn-ghost" onclick="Build.commit('invest')">Invest Now</button>`}</div>`;
    openModal(head+`<div class="modal-body">${stepper}${inner}${nav}</div>`);
    if(s===1)this.updateProj();
  },
  stepPlan(e){
    return `<div style="max-width:560px;margin:0 auto">
      <h3 style="margin-bottom:4px">Shape your plan</h3>
      <p style="color:var(--ink-mute);font-size:13.5px;margin-top:0">Move the sliders. Everything below updates live. You are not investing yet.</p>
      <div class="card" style="margin:16px 0">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="color:var(--ink-soft);font-size:13.5px">Initial amount</span><span class="slider-val" id="b-amtLab" style="font-size:20px">${money(this.amount)}</span></div>
        <input class="rng" type="range" min="500" max="100000" step="500" value="${this.amount}" aria-label="Initial amount" oninput="Build.setAmt(+this.value)">
        <div class="quick-amt">${[1000,5000,10000,25000,50000].map(a=>`<button class="chip" onclick="Build.setAmt(${a});Build.syncSliders()">${money(a)}</button>`).join('')}</div>
      </div>
      <div class="grid cols-2" style="margin-bottom:16px">
        <div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="color:var(--ink-soft);font-size:13.5px">Monthly contribution</span><span class="slider-val" id="b-monLab">${money(this.monthly)}</span></div>
          <input class="rng" type="range" min="0" max="2000" step="50" value="${this.monthly}" aria-label="Monthly contribution" oninput="Build.setMon(+this.value)"><div class="slider-lab"><span>$0</span><span>$2,000</span></div></div>
        <div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="color:var(--ink-soft);font-size:13.5px">Investment horizon</span><span class="slider-val" id="b-horLab">${this.horizon} yrs</span></div>
          <input class="rng" type="range" min="1" max="30" step="1" value="${this.horizon}" aria-label="Investment horizon" oninput="Build.setHor(+this.value)"><div class="slider-lab"><span>1 yr</span><span>30 yrs</span></div></div>
      </div>
      <div class="card card-sheen" style="background:linear-gradient(120deg,rgba(220,0,50,.1),transparent)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b>Projected value</b><span class="why" onclick="TFloat.show('<b>What if?</b> This projection compounds your amount plus monthly contributions at an illustrative return for the ${esc(e.name)} style. It is a scenario, not a promise. Markets vary and returns are never guaranteed.','')">What is this?</span></div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:8px">
          <div class="metric"><span class="k">In ${this.horizon} years, illustrative</span><span class="val" id="b-final" style="font-size:26px;color:#34D399">${money(this.amount)}</span></div>
          <div class="metric"><span class="k">You invest</span><span class="val" id="b-invested">${money(this.amount)}</span></div>
          <div class="metric"><span class="k">Illustrative growth</span><span class="val" id="b-gain" style="color:var(--teal-2)">$0</span></div>
        </div>
        <div id="b-projchart"></div>
      </div>
      <div class="tara-msg" style="margin-top:16px"><div class="h">Tara</div>Investing monthly rather than in one lump smooths your entry and rewards consistency. Notice how the projection leans on your contributions, not just the starting amount.</div>
    </div>`;
  },
  stepAdjust(e){
    const rl=(typeof e.risk==='string')?e.risk:(e.riskLbl||'Moderate');
    const rs=this.liveRisk(e);const div=divScore(adjustAllocation(e.alloc||e.allocation||[],this.risk,this.shariah,this.esg,this.income));
    const ann=Math.round(expAnnual(e,this.risk)*1000)/10;
    const rcol=rs<=40?'#34D399':rs<=65?'#FBBF24':'#FB7185';
    return `<div style="max-width:600px;margin:0 auto">
      <h3 style="margin-bottom:4px">Tune the risk to fit you</h3>
      <p style="color:var(--ink-mute);font-size:13.5px;margin-top:0">Keep the spirit of the style, adjusted to your comfort. Metrics update instantly.</p>
      <div class="seg" style="margin:16px 0">${['Conservative','Balanced','Original','Higher Conviction'].map(r=>`<button class="${this.risk===r?'on':''}" onclick="Build.risk='${r}';Build.render()">${r}</button>`).join('')}</div>
      <div class="grid cols-2" style="margin-bottom:16px">
        <div class="card" style="display:flex;align-items:center;gap:16px">
          <div class="match-ring" style="width:76px;height:76px"><svg viewBox="0 0 52 52" style="width:76px;height:76px;transform:rotate(-90deg)"><circle cx="26" cy="26" r="22" fill="none" stroke="rgba(10,20,32,.10)" stroke-width="5"/><circle cx="26" cy="26" r="22" fill="none" stroke="${rcol}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${2*Math.PI*22}" stroke-dashoffset="${2*Math.PI*22*(1-rs/100)}" style="transition:.5s"/></svg><span class="lbl" style="color:${rcol};font-size:17px">${rs}</span></div>
          <div><div style="font-size:12px;color:var(--ink-mute)">Risk score <span class="help" data-tip="Risk-adjusted return">i</span></div><div style="font-weight:700;font-size:15px">${rs<USER.dna.riskScore-8?'Lower risk than you':rs>USER.dna.riskScore+8?'Higher risk than you':'In line with your DNA'}</div><div style="font-size:12px;color:var(--ink-mute)">Your DNA sits at ${USER.dna.riskScore}</div></div>
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span style="color:var(--ink-soft)">Diversification <span class="help" data-tip="Diversification Score">i</span></span><b>${div}/100</b></div>
          <div class="meter" style="margin-bottom:14px"><i style="width:${div}%;background:linear-gradient(90deg,var(--teal),var(--sky))"></i></div>
          <div style="display:flex;gap:20px"><div class="metric"><span class="k">Illustrative return / yr</span><span class="val">${ann}%</span></div><div class="metric"><span class="k">Expected volatility</span><span class="val">${Math.round((e.vol||14)*this.volMult())}%</span></div></div>
        </div>
      </div>
      <div class="tara-msg" style="margin-bottom:16px"><div class="h">What this does</div>${esc(riskExplain(this.risk))}</div>
      ${[['shariah','Shariah compliant','Screen out non-compliant sectors and interest-based holdings'],['esg','ESG screened','Favour stronger environmental, social and governance profiles'],['income','Income focused','Tilt toward dividends, coupons and yield']].map(t=>`
        <div class="toggle-row" role="switch" aria-checked="${this[t[0]]}" tabindex="0" onclick="Build.${t[0]}=!Build.${t[0]};Build.render()" onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();Build.${t[0]}=!Build.${t[0]};Build.render()}"><div><b style="font-size:14px">${t[1]}</b><div style="font-size:12px;color:var(--ink-mute)">${t[2]}</div></div><div class="sw ${this[t[0]]?'on':''}"></div></div>`).join('')}
    </div>`;
  },
  volMult(){return this.risk==='Conservative'?0.7:this.risk==='Balanced'?0.85:this.risk==='Higher Conviction'?1.25:1;},
  liveRisk(e){let r=riskScoreOf(e);r+= this.risk==='Conservative'?-18:this.risk==='Balanced'?-8:this.risk==='Higher Conviction'?15:0; if(this.income)r-=5; return Math.max(5,Math.min(98,Math.round(r)));},
  setAmt(v){this.amount=v;const l=$('#b-amtLab');if(l)l.textContent=money(v);this.updateProj();},
  setMon(v){this.monthly=v;const l=$('#b-monLab');if(l)l.textContent=money(v);this.updateProj();},
  setHor(v){this.horizon=v;const l=$('#b-horLab');if(l)l.textContent=v+' yrs';this.updateProj();},
  syncSliders(){const r=$$('.modal-body .rng');if(r[0])r[0].value=this.amount;},
  stepAmt(d){this.amount=Math.max(500,this.amount+d);this.render();},
  updateProj(){
    const e=findEntity(this.id);if(!e)return;const ann=expAnnual(e,this.risk);
    const pr=project(this.amount,this.monthly,this.horizon,ann);
    const f=$('#b-final'),inv=$('#b-invested'),g=$('#b-gain'),pc=$('#b-projchart');
    if(f){f.textContent=money(pr.final);f.previousElementSibling; }
    const lab=f&&f.parentElement.querySelector('.k');if(lab)lab.textContent='In '+this.horizon+' years, illustrative';
    if(inv)inv.textContent=money(pr.invested);
    if(g)g.textContent=money(Math.max(0,pr.final-pr.invested));
    if(pc)pc.innerHTML=miniArea(pr.series);
  },
  preview(e){
    const base=e.alloc||e.allocation||[];
    const adj=adjustAllocation(base,this.risk,this.shariah,this.esg,this.income);
    const amt=this.amount;
    const feePct=0.35 + (e.cat==='crypto'?0.25:0) + (this.esg?0.1:0);
    const fee=amt*feePct/100;
    const cash=adj.find(a=>/cash|stable/i.test(a.k));
    const expVol=Math.round((e.vol||14)*this.volMult());
    const expRisk=this.risk==='Conservative'?'Lower than original':this.risk==='Higher Conviction'?'Higher than original':this.risk==='Balanced'?'Slightly lower':'As per style';
    const pr=project(amt,this.monthly,this.horizon,expAnnual(e,this.risk));
    const rows=adj.map((a,i)=>`<div style="display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:center;gap:9px;min-width:0"><span style="width:9px;height:9px;border-radius:3px;background:${PIE_COLORS[i%PIE_COLORS.length]};flex:none"></span><span style="font-size:13.5px">${esc(a.k)}</span></div>
      <div style="font-variant-numeric:tabular-nums;color:var(--ink-soft);font-size:13px">${a.v}%</div>
      <div style="font-weight:700;font-variant-numeric:tabular-nums;min-width:78px;text-align:right">${money(amt*a.v/100)}</div></div>`).join('');
    const diffs=allocDiff(base,adj);
    return `<div>
      <h3 style="margin-bottom:4px">Your version of ${esc(e.name)}</h3>
      <p style="color:var(--ink-mute);font-size:13px;margin-top:0">${this.risk} tilt${this.shariah?' · Shariah':''}${this.esg?' · ESG':''}${this.income?' · Income':''} · ${money(amt)} + ${money(this.monthly)}/mo · ${this.horizon} yrs</p>
      <div class="card" style="display:flex;align-items:center;gap:14px;margin:14px 0;flex-wrap:wrap">
        <div style="flex:1;min-width:120px"><div style="font-size:12px;color:var(--ink-mute)">Amount to invest. Holdings below update live</div><div class="slider-val" style="font-size:22px">${money(amt)}</div></div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-ghost" style="width:46px;height:46px;padding:0;font-size:24px;border-radius:12px" aria-label="Decrease amount by 500" onclick="Build.stepAmt(-500)">−</button>
          <button class="btn btn-ghost" style="width:46px;height:46px;padding:0;font-size:22px;border-radius:12px" aria-label="Increase amount by 500" onclick="Build.stepAmt(500)">+</button>
        </div>
      </div>
      <div class="grid cols-2" style="margin:14px 0">
        <div class="card">${pieBlock(adj,116)}</div>
        <div class="card" style="display:flex;flex-direction:column;justify-content:center;gap:14px">
          ${metric('Expected volatility', expVol+'%','Volatility')}
          ${metric('Expected risk', expRisk)}
          ${metric('Cash allocation', (cash?cash.v:0)+'%')}
          ${metric('Estimated fees / yr', money(fee)+' ('+feePct.toFixed(2)+'%)')}
        </div>
      </div>
      <div class="card card-sheen" style="margin-bottom:14px;background:linear-gradient(120deg,rgba(220,0,50,.08),transparent)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Long-term growth projection</b><span class="pill">${this.horizon}-year horizon</span></div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:6px"><div class="metric"><span class="k">Projected value, illustrative</span><span class="val" style="font-size:22px;color:#34D399">${money(pr.final)}</span></div><div class="metric"><span class="k">Total invested</span><span class="val">${money(pr.invested)}</span></div></div>
        ${miniArea(pr.series)}</div>
      <div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:6px">Proposed holdings</b>${rows}
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:12px;padding:12px 0 2px;font-weight:800"><div>Total</div><div></div><div style="text-align:right;min-width:78px">${money(amt)}</div></div></div>
      <div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:10px">Difference from the original style</b>
        ${diffs.length?diffs.map(d=>`<div style="display:flex;justify-content:space-between;font-size:13.5px;padding:7px 0;border-bottom:1px solid var(--line)"><span>${esc(d.k)}</span><span class="pill ${d.delta>0?'pos':'neg'}">${d.delta>0?'+':''}${d.delta}%</span></div>`).join(''):'<div style="color:var(--ink-mute);font-size:13px">Matches the original style closely.</div>'}</div>
      <div class="card" style="background:linear-gradient(120deg,rgba(124,108,255,.14),transparent);border-color:rgba(124,108,255,.3);margin-bottom:14px">
        <div style="display:flex;gap:12px"><span class="tara-orb" style="width:28px;height:28px;flex:none"></span>
        <div><div class="h" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6C5CE7;font-weight:700;margin-bottom:6px">Why Tara adjusted this</div>
        <div style="font-size:13.5px;color:#2E2A5B;line-height:1.6">${esc(buildRationale(e,this))}</div></div></div></div>
      <div class="disclaimer"><svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span><b>Capital at risk.</b> This is an educational model portfolio showing similar exposure to the ${esc(e.name)} style, not advice or an official portfolio. Illustrative figures only. For regulated safety the default action is Add to My Plan, where Tara will check it against your goals before anything is invested.</span></div>
    </div>`;
  },
  commit(mode){
    closeAll();celebrate();
    if(mode==='plan')successModal('Added to your plan','Tara will review this model against your goals before anything is invested. You can adjust or remove it anytime. Capital is at risk.');
    else successModal('Draft order created','A capital-at-risk review is required before any investment is placed. Nothing has been invested yet.');
  }
};
function expAnnual(e,risk){const rl=(typeof e.risk==='string')?e.risk:(e.riskLbl||'Moderate');const base={'Low':.05,'Low-Moderate':.06,'Moderate':.075,'Moderate-High':.09,'High':.11,'Very High':.14,'Extreme':.15}[rl]||.075;const tilt={'Conservative':.8,'Balanced':.9,'Original':1,'Higher Conviction':1.18}[risk]||1;return base*tilt;}
function project(amount,monthly,years,annual){let bal=amount;const series=[amount];for(let y=1;y<=years;y++){for(let m=0;m<12;m++)bal=bal*(1+annual/12)+monthly;series.push(bal);}return {final:bal,invested:amount+monthly*12*years,series};}
function divScore(alloc){const t=alloc.reduce((s,x)=>s+x.v,0)||1;const hhi=alloc.reduce((s,x)=>s+Math.pow(x.v/t,2),0);return Math.max(10,Math.min(99,Math.round((1-hhi)*100)));}
function miniArea(series,w=560,h=110){const min=Math.min(...series),max=Math.max(...series),rg=(max-min)||1,step=w/(series.length-1);const xy=series.map((v,i)=>[i*step,h-6-((v-min)/rg)*(h-16)]);const line=xy.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');const area=line+` L${w} ${h} L0 ${h} Z`;return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px"><defs><linearGradient id="mag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#DC0032" stop-opacity=".32"/><stop offset="1" stop-color="#DC0032" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#mag)"/><path d="${line}" fill="none" stroke="#DC0032" stroke-width="2.4" stroke-linejoin="round"/></svg>`;}
function openBuild(id){Build.open(id);}
function riskExplain(r){return {
  'Conservative':'Trims the most volatile holdings, lifts bonds and cash. Expect a smoother ride and lower expected return than the original.',
  'Balanced':'A gentle de-risk of the original, keeping most of its character with a little more ballast.',
  'Original':'Keeps the style close to its published shape, adjusted only for your compliance toggles.',
  'Higher Conviction':'Leans further into the style\'s core holdings and trims cash. Higher expected return and higher risk. Only if your horizon and nerves allow.'
}[r];}
function adjustAllocation(base,risk,shariah,esg,income){
  let a=base.map(x=>({k:x.k,v:x.v}));
  const bump=(match,delta)=>{const it=a.find(x=>match.test(x.k));if(it)it.v+=delta;};
  if(risk==='Conservative'){a.forEach(x=>{if(/equit|crypto|bitcoin|ethereum|innovation|growth|infra|token/i.test(x.k))x.v=Math.round(x.v*0.7);});pushOrAdd(a,'Bonds',10);pushOrAdd(a,'Cash / Stable',8);}
  else if(risk==='Balanced'){a.forEach(x=>{if(/crypto|bitcoin|innovation|token|infra/i.test(x.k))x.v=Math.round(x.v*0.85);});pushOrAdd(a,'Bonds',5);pushOrAdd(a,'Cash / Stable',3);}
  else if(risk==='Higher Conviction'){a.forEach(x=>{if(/cash|stable/i.test(x.k))x.v=Math.round(x.v*0.5);if(/equit|crypto|bitcoin|growth|innovation/i.test(x.k))x.v=Math.round(x.v*1.15);});}
  if(income){a.forEach(x=>{if(/growth|innovation|token|infra/i.test(x.k))x.v=Math.round(x.v*0.8);});pushOrAdd(a,'Dividend / Income',10);}
  if(esg){pushOrAdd(a,'ESG screen applied',0);}
  if(shariah)a=a.map(x=>({k:x.k.replace(/Bonds/,'Sukuk'),v:x.v}));
  // merge duplicate keys (e.g. multiple Sukuk sleeves after screening)
  const merged=[];a.forEach(x=>{const it=merged.find(m=>m.k===x.k);if(it)it.v+=x.v;else merged.push({k:x.k,v:x.v});});
  a=merged;
  // normalise to 100
  let tot=a.reduce((s,x)=>s+x.v,0)||1;a=a.filter(x=>x.v>0);a.forEach(x=>x.v=Math.round(x.v/tot*100));
  // fix rounding
  let diff=100-a.reduce((s,x)=>s+x.v,0);if(a.length)a[0].v+=diff;
  return a;
}
function pushOrAdd(a,key,v){if(v===0){if(!a.find(x=>x.k===key))return;return;}const it=a.find(x=>x.k===key);if(it)it.v+=v;else a.push({k:key,v});}
function allocDiff(base,adj){const bm={};base.forEach(x=>bm[x.k]=x.v);const out=[];adj.forEach(x=>{const b=bm[x.k]||0;const d=x.v-b;if(Math.abs(d)>=2)out.push({k:x.k,delta:d});});return out.slice(0,6);}
function buildRationale(e,b){
  const bits=[];
  if(b.risk==='Conservative')bits.push('you chose a Conservative tilt, so I trimmed the most volatile sleeves and added bonds and cash to cut expected volatility');
  else if(b.risk==='Higher Conviction')bits.push('you chose Higher Conviction, so I leaned into the core holdings and reduced cash, which raises both expected return and risk');
  else if(b.risk==='Balanced')bits.push('you chose a Balanced tilt, so I softened the riskiest positions while keeping the style\'s character');
  else bits.push('you kept the Original shape, so I preserved the published style');
  if(b.shariah)bits.push('applied Shariah screens and swapped conventional bonds for sukuk');
  if(b.esg)bits.push('applied an ESG screen');
  if(b.income)bits.push('added an income tilt toward dividends and yield');
  if(e.cat==='crypto')bits.push('kept a stable buffer because crypto drawdowns can exceed 70%');
  const txt=bits.join(', ');
  return txt.charAt(0).toUpperCase()+txt.slice(1)+'. This stays true to the idea of learning from the style rather than blindly copying it.';
}

/* ============================================================
   TARA panel
   ============================================================ */
/* genuinely computed, personalised insight: user's tech weight vs similar-goal peers */
function peerTechDelta(){
  const peers=COMMUNITY.filter(c=>c.cat==='Balanced');
  const techs=peers.map(c=>(c.sectors||[]).find(s=>/tech/i.test(s.k))).filter(Boolean).map(s=>s.v);
  const avg=techs.length?Math.round(techs.reduce((a,b)=>a+b,0)/techs.length):26;
  const mine=(USER.sectors.find(s=>/tech/i.test(s.k))||{v:34}).v;
  const naGeo=(USER.geo.find(g=>/north america/i.test(g.k))||{v:64}).v;
  return {mine,avg,delta:mine-avg,naGeo};
}
const Tara={
  open(ctx){
    $('#taraPanel').classList.add('show');$('#scrim').classList.add('show');
    if(!$('#taraBody').dataset.init){this.say(`Hi ${USER.name.split(' ')[0]}. I read your actual holdings, not generic tips. Ask how a style fits your plan, where your risk really sits, or what to change first.`);$('#taraBody').dataset.init='1';}
    this.suggest(['Am I too concentrated?','Which style fits me best?','Explain risk-adjusted return','Am I chasing returns?']);
  },
  close(){$('#taraPanel').classList.remove('show');if(!$('#modal').classList.contains('show'))$('#scrim').classList.remove('show');},
  say(html,you){const b=$('#taraBody');b.appendChild(el(`<div class="tara-msg ${you?'you':''}">${you?'':'<div class="h">Tara</div>'}${html}</div>`));b.scrollTop=b.scrollHeight;},
  suggest(arr){$('#taraSugs').innerHTML=arr.map(s=>`<button class="tara-sug" onclick="Tara.ask('${esc(s).replace(/'/g,"\\'")}')">${esc(s)}</button>`).join('');},
  ask(q){this.open();this.say(q,true);setTimeout(()=>this.reply(q),260);},
  reply(q){
    const l=q.toLowerCase();let r;const p=peerTechDelta();
    if(l.includes('diversif')||l.includes('concentrat'))r=`Here is the specific issue: ${p.mine}% of your equities are in technology, about ${Math.abs(p.delta)}% ${p.delta>0?'higher':'lower'} than investors with goals like yours, and ${p.naGeo}% sits in North America. Your diversification score is ${USER.dna.diversification}/100 as a result. Adding international and real assets, the way the Endowment style does, is your highest-impact move. Shall I open that comparison?`;
    else if(l.includes('fit')||l.includes('suit')||l.includes('dna'))r=`With a Moderate risk score of ${USER.dna.riskScore} and a long horizon, the Global ETF Core, Bogle indexing and the All-Weather model fit you best. They match your discipline and fix the concentration above. High-growth and crypto styles score lower for you: not worse, just a poor fit for your DNA.`;
    else if(l.includes('risk-adjust')||l.includes('sharpe'))r=`${METRICS['Risk-adjusted return'].d} ${METRICS['Risk-adjusted return'].tara}`;
    else if(l.includes('chas')||l.includes('warn'))r=`Worth checking. Investor #8123 has the highest one-year return here and a 52% drawdown to match. Your DNA says you would likely sell into a drop that deep. Judge fit and risk first; treat one hot year as noise, not skill.`;
    else if(l.includes('drawdown'))r=`${METRICS['Max drawdown'].d} ${METRICS['Max drawdown'].tara}`;
    else if(l.includes('behaviour'))r=`${METRICS['Behaviour Score'].d} ${METRICS['Behaviour Score'].tara} Yours is ${USER.dna.behaviour}/100, which is a real strength.`;
    else if(l.includes('shariah'))r=`For Shariah compliance, look at the Islamic Growth and Shariah Growth models, or filter Community Investors by Shariah. Investor #9032 runs a fully compliant balanced book. You can also toggle Shariah on inside any Build Similar flow.`;
    else r=`Here is how I would think about that: focus on whether a style fits your risk, horizon and diversification, understand every metric before you act, and never chase last year's winner. Would you like me to compare a specific investor with your portfolio, or explain a metric?`;
    this.say(r);
    this.suggest(['Compare me with my best match','Explain diversification score','Show me low-volatility styles','Which crypto style is least risky?']);
  },
  suit(id){
    const e=findEntity(id);if(!e)return;
    this.open();
    const match=e.match||matchFor(e);
    const er=riskScoreOf(e);
    let verdict;
    if(match>=80)verdict=`This is a strong match (${match}%) for your Investor DNA. The risk level lines up with your Moderate profile and it would suit your long horizon.`;
    else if(match>=60)verdict=`A reasonable match (${match}%). It broadly fits, but ${er>USER.dna.riskScore?'it runs hotter than your risk profile, so I would use the Conservative tilt':'it is more defensive than you, so expect steadier but slower growth'}.`;
    else verdict=`Honestly, a low match (${match}%) for you. ${e.cat==='crypto'?'It is a high-risk crypto style, so only ever a small satellite.':'It takes more risk than your DNA suggests you want.'} Study it to learn, but do not make it a core.`;
    this.say(`<b>Does ${esc(e.name)} suit you?</b><br>${verdict}<br><br>${esc(e.tara||'')}`);
    this.suggest([`Build a version that suits me`,`Compare ${e.name.split(' ')[0]} with my portfolio`,'Explain the risks','Show me a better-matched style']);
    $('#taraSugs').firstChild.onclick=()=>openBuild(id);
    $('#taraSugs').children[1].onclick=()=>openCompare(id);
  },
  dna(){this.open();this.say(`<b>Your Investor DNA: ${USER.dna.style}</b><br>${USER.dna.summary}<br><br>In short: your behaviour score of ${USER.dna.behaviour} is elite, your diversification of ${USER.dna.diversification} is the thing to work on. Discipline is your edge.`);this.suggest(['How do I improve diversification?','Which style fits me best?','Compare me with an investor']);},
  health(){const hs=healthScore();this.open();this.say(`<b>Portfolio health: ${hs.score}/100 (${hs.grade})</b><br>I weigh five factors: ${hs.factors.map(f=>f[0]+' '+f[1]).join(', ')}. My confidence is ${hs.confidence}%.<br><br>The single biggest lift is diversification. Widening beyond North American tech, toward international and real assets, would move this score the most. Want me to show a style that does exactly that?`);this.suggest(['Show me a more diversified style','Compare me with the endowment model','What is dragging my score down?','Explain the health score']);
    $('#taraSugs').children[0].onclick=()=>openProfile('swensen');$('#taraSugs').children[1].onclick=()=>openCompare('c12');}
};

/* ============================================================
   v2: INTERACTIVE PERFORMANCE CHART (timeframes + hover crosshair)
   ============================================================ */
const CHARTS={};
const TF={'1M':22,'3M':30,'6M':40,'1Y':52,'3Y':60,'ALL':80};
function buildChart(key,seed,up,tf){
  const n=TF[tf]||52;const r=rng(seed);
  // realistic cumulative-return path (%) that trends to a modest, timeframe-scaled end
  const endBase={'1M':3,'3M':6,'6M':10,'1Y':16,'3Y':42,'ALL':66}[tf]||16;
  const end=endBase*(up?1:-0.45)*(0.65+r()*0.7);
  const amp=Math.max(2.5,Math.abs(end)*0.28);
  const vals=[0];
  for(let i=1;i<n;i++){const trend=end*(i/(n-1));vals.push(trend+(r()-0.5)*2*amp);}
  vals[n-1]=end;
  const w=680,h=200,min=Math.min(...vals),max=Math.max(...vals),rg=(max-min)||1,step=w/(n-1);
  const pts=vals.map((val,i)=>({x:i*step,y:h-18-((val-min)/rg)*(h-40),val}));
  CHARTS[key]={pts,w,h,up,tf,seed,last:pts[pts.length-1]};
}
function perfInteractive(key,seed,up,tf){
  tf=tf||'1Y';buildChart(key,seed,up,tf);
  return `<div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:baseline;gap:10px"><span id="${key}-val" class="dnum" style="font-size:23px;font-weight:800"></span><span id="${key}-lab" style="font-size:12px;color:var(--ink-mute)"></span></div>
      <div class="tf-row" role="tablist" aria-label="Chart timeframe">${Object.keys(TF).map(t=>`<button role="tab" aria-selected="${t===tf}" class="${t===tf?'on':''}" onclick="setTF('${key}',${seed},${up?1:0},'${t}')">${t}</button>`).join('')}</div>
    </div>
    <div class="chart-shell" data-chart="${key}" id="${key}-shell">${renderPerfInner(key)}</div>
    <div style="font-size:11px;color:var(--ink-mute);margin-top:6px">Illustrative growth path for the style. Not a track record or a forecast. Hover to explore.</div>
  </div>`;
}
function renderPerfInner(key){
  const c=CHARTS[key];const {pts,w,h}=c;
  const line=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
  const area=line+` L${w} ${h} L0 ${h} Z`;
  const col=c.last.val>=0?'#00E0A0':'#FB7185';const id='pgi'+key.replace(/[^a-z0-9]/gi,'');
  const grid=[0.25,0.5,0.75].map(f=>`<line x1="0" x2="${w}" y1="${(h*f).toFixed(0)}" y2="${(h*f).toFixed(0)}" stroke="rgba(10,20,32,.06)"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".3"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
  </svg><div class="crosshair" id="${key}-cx"></div><div class="chart-dot" id="${key}-dot"></div><div class="chart-tip" id="${key}-tip"></div>`;
}
function setTF(key,seed,up,tf){
  buildChart(key,seed,!!up,tf);const shell=$('#'+key+'-shell');if(!shell)return;
  shell.innerHTML=renderPerfInner(key);
  const row=shell.parentElement.querySelector('.tf-row');
  if(row)[...row.children].forEach(b=>{const on=b.textContent===tf;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);});
  updatePerfLabel(key);
}
function updatePerfLabel(key,idx){
  const c=CHARTS[key];if(!c)return;const p=(idx==null)?c.last:c.pts[idx];
  const v=$('#'+key+'-val'),l=$('#'+key+'-lab');
  if(v){v.textContent=(p.val>=0?'+':'')+p.val.toFixed(1)+'%';v.style.color=p.val>=0?'#34D399':'#FB7185';}
  if(l)l.textContent=(idx==null)?c.tf+' return, illustrative':'hovering point '+(idx+1)+' of '+c.pts.length;
}
function initCharts(scope){(scope||document).querySelectorAll?.('[data-chart]').forEach(s=>updatePerfLabel(s.dataset.chart));}
function moveChartCursor(shell,clientX){
  const key=shell.dataset.chart,c=CHARTS[key];if(!c)return;
  const r=shell.getBoundingClientRect();if(!r.width)return;
  const fx=(clientX-r.left)/r.width;const idx=Math.max(0,Math.min(c.pts.length-1,Math.round(fx*(c.pts.length-1))));
  const p=c.pts[idx],px=(p.x/c.w)*r.width,py=(p.y/c.h)*r.height;
  const cx=$('#'+key+'-cx'),dot=$('#'+key+'-dot'),tip=$('#'+key+'-tip');
  if(cx){cx.style.left=px+'px';cx.style.opacity=1;}
  if(dot){dot.style.left=px+'px';dot.style.top=py+'px';dot.style.opacity=1;}
  if(tip){tip.style.left=Math.max(30,Math.min(r.width-30,px))+'px';tip.style.top=py+'px';tip.style.opacity=1;tip.innerHTML=`<b>${p.val>=0?'+':''}${p.val.toFixed(1)}%</b>`;}
  updatePerfLabel(key,idx);
}
function hideChartCursor(shell){const k=shell.dataset.chart;['-cx','-dot','-tip'].forEach(s=>{const el=$('#'+k+s);if(el)el.style.opacity=0;});updatePerfLabel(k);}
document.addEventListener('mousemove',e=>{const shell=e.target.closest&&e.target.closest('.chart-shell');if(shell)moveChartCursor(shell,e.clientX);},{passive:true});
document.addEventListener('mouseout',e=>{const shell=e.target.closest&&e.target.closest('.chart-shell');if(shell&&!shell.contains(e.relatedTarget))hideChartCursor(shell);});
/* touch support: scrub the chart on mobile */
document.addEventListener('touchstart',e=>{const shell=e.target.closest&&e.target.closest('.chart-shell');if(shell&&e.touches[0])moveChartCursor(shell,e.touches[0].clientX);},{passive:true});
document.addEventListener('touchmove',e=>{const shell=e.target.closest&&e.target.closest('.chart-shell');if(shell&&e.touches[0])moveChartCursor(shell,e.touches[0].clientX);},{passive:true});
document.addEventListener('touchend',e=>{const shell=e.target.closest&&e.target.closest('.chart-shell');if(shell)setTimeout(()=>hideChartCursor(shell),1400);},{passive:true});

/* ============================================================
   v2: RADAR, SCATTER, OVERLAP VISUALS
   ============================================================ */
function radar(axes,a,b,size=280){
  const cx=size/2,cy=size/2-6,R=size*0.34,N=axes.length;
  const pt=(i,val)=>{const ang=-Math.PI/2+i*2*Math.PI/N,rr=R*val/100;return [cx+rr*Math.cos(ang),cy+rr*Math.sin(ang)];};
  const rings=[0.25,.5,.75,1].map(f=>`<polygon points="${axes.map((_,i)=>{const ang=-Math.PI/2+i*2*Math.PI/N;return (cx+R*f*Math.cos(ang)).toFixed(1)+','+(cy+R*f*Math.sin(ang)).toFixed(1);}).join(' ')}" fill="none" stroke="rgba(10,20,32,.07)"/>`).join('');
  const spokes=axes.map((_,i)=>{const ang=-Math.PI/2+i*2*Math.PI/N;return `<line x1="${cx}" y1="${cy}" x2="${(cx+R*Math.cos(ang)).toFixed(1)}" y2="${(cy+R*Math.sin(ang)).toFixed(1)}" stroke="rgba(10,20,32,.06)"/>`;}).join('');
  const poly=(arr,col,fill)=>`<polygon points="${arr.map((v,i)=>pt(i,v).map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="${col}" stroke-width="2" style="transition:.4s"/>`;
  const labels=axes.map((lab,i)=>{const [x,y]=pt(i,124);return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="#8ea1b3" font-size="10.5" font-weight="600" text-anchor="middle" dominant-baseline="middle">${esc(lab)}</text>`;}).join('');
  return `<svg viewBox="0 0 ${size} ${size}" style="width:100%;max-width:340px;margin:0 auto;display:block">${rings}${spokes}${poly(b,'#7C6CFF','rgba(124,108,255,.16)')}${poly(a,'#00E0A0','rgba(176,17,61,.18)')}${labels}</svg>`;
}
function scatterPlot(points,opts){
  opts=opts||{};const w=560,h=320,pad=44;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const xmin=0,xmax=Math.max(...xs)*1.1,ymin=Math.min(0,...ys)-2,ymax=Math.max(...ys)*1.15;
  const sx=v=>pad+ (v-xmin)/(xmax-xmin||1)*(w-pad*1.5);
  const sy=v=>h-pad-(v-ymin)/(ymax-ymin||1)*(h-pad*1.6);
  const gridX=[0,20,40,60,80].filter(v=>v<=xmax).map(v=>`<line x1="${sx(v)}" y1="${pad-10}" x2="${sx(v)}" y2="${h-pad}" stroke="rgba(10,20,32,.06)"/><text x="${sx(v)}" y="${h-pad+16}" fill="#6d8296" font-size="10" text-anchor="middle">${v}%</text>`).join('');
  const gridY=[0,5,10,15,20].filter(v=>v<=ymax).map(v=>`<line x1="${pad}" y1="${sy(v)}" x2="${w-pad*0.5}" y2="${sy(v)}" stroke="rgba(10,20,32,.06)"/><text x="${pad-8}" y="${sy(v)+3}" fill="#6d8296" font-size="10" text-anchor="end">${v}%</text>`).join('');
  const dots=points.map(p=>{
    const col=p.me?'#E7C27D':(p.cat==='crypto'?'#F7931A':p.y/(p.x||1)>0.5?'#34D399':'#7C6CFF');
    if(p.me)return `<g><circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="9" fill="${col}" stroke="#04150f" stroke-width="2"><title>${esc(p.label)} (you)</title></circle><text x="${sx(p.x)}" y="${sy(p.y)-14}" fill="#E7C27D" font-size="10.5" font-weight="700" text-anchor="middle">You</text></g>`;
    return `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="6" fill="${col}" fill-opacity=".85" style="cursor:pointer;transition:.2s" onmouseover="this.setAttribute('r',9)" onmouseout="this.setAttribute('r',6)"><title>${esc(p.label)} · risk ${p.x}% · return ${p.y}%</title></circle>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%">
    ${gridX}${gridY}
    <text x="${w/2}" y="${h-6}" fill="#8ea1b3" font-size="11" text-anchor="middle" font-weight="600">Risk (volatility) →</text>
    <text x="14" y="${h/2}" fill="#8ea1b3" font-size="11" text-anchor="middle" font-weight="600" transform="rotate(-90 14 ${h/2})">Return →</text>
    ${dots}</svg>`;
}
function overlapViz(user,entity){
  const ua={};user.allocation.forEach(x=>ua[bucket(x.k)]=(ua[bucket(x.k)]||0)+x.v);
  const ea={};(entity.alloc||entity.allocation||[]).forEach(x=>ea[bucket(x.k)]=(ea[bucket(x.k)]||0)+x.v);
  const keys=[...new Set([...Object.keys(ua),...Object.keys(ea)])];
  return `<div class="hbar">${keys.map(k=>{const y=ua[k]||0,t=ea[k]||0,sh=Math.min(y,t);
    return `<div style="display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:center;font-size:12.5px">
      <span>${esc(k)}</span>
      <div style="position:relative;height:22px;border-radius:7px;background:rgba(10,20,32,.06);overflow:hidden">
        <div style="position:absolute;top:0;bottom:0;left:0;width:${y}%;background:rgba(220,0,50,.35)"></div>
        <div style="position:absolute;top:0;bottom:0;left:0;width:${t}%;background:rgba(124,108,255,.3)"></div>
        <div style="position:absolute;top:0;bottom:0;left:0;width:${sh}%;background:linear-gradient(90deg,rgba(176,17,61,.55),rgba(124,108,255,.55))"></div>
        <span style="position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:10.5px;color:#4A0016">you ${y}% · them ${t}%</span>
      </div></div>`;}).join('')}</div>
    <div style="display:flex;gap:16px;margin-top:12px;font-size:11.5px;color:var(--ink-mute)"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:rgba(220,0,50,.55)"></i> You</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:rgba(124,108,255,.5)"></i> Them</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:linear-gradient(90deg,#00E0A0,#7C6CFF)"></i> Shared exposure</span></div>`;
}
function bucket(k){if(/crypto|bitcoin|ethereum|stable|token|staking|defi|infra|btc|eth|l1|l2|digital/i.test(k))return 'Crypto';if(/bond|sukuk|treasur|credit|fixed|tips|coupon/i.test(k))return 'Bonds';if(/cash|money market|t-bill/i.test(k))return 'Cash';if(/gold|commod|real|reit/i.test(k))return 'Real assets';return 'Equities';}

/* ============================================================
   v2: AI HEALTH SCORE + CONFIDENCE
   ============================================================ */
function healthScore(){
  const d=USER.dna;
  const factors=[
    ['Diversification',d.diversification,0.3],
    ['Behaviour',d.behaviour,0.25],
    ['Consistency',d.consistency,0.2],
    ['Risk alignment',100-Math.abs(d.riskScore-55),0.15],
    ['Cost efficiency',72,0.1]
  ];
  const score=Math.round(factors.reduce((s,f)=>s+f[1]*f[2],0));
  return {score,factors,confidence:88,grade:score>=80?'Strong':score>=65?'Healthy':score>=50?'Developing':'Needs attention'};
}
function healthRing(score){
  const r=58,c=2*Math.PI*r,off=c*(1-score/100);
  const col=score>=80?'#34D399':score>=65?'#168335':score>=50?'#FBBF24':'#FB7185';
  return `<div class="health-ring"><svg viewBox="0 0 132 132" style="transform:rotate(-90deg)"><circle cx="66" cy="66" r="${r}" fill="none" stroke="rgba(10,20,32,.07)" stroke-width="9"/><circle cx="66" cy="66" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" style="transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)" data-dash="${off}"/></svg><div class="lbl"><span class="n" style="color:${col}">${score}</span><span class="s">Health</span></div></div>`;
}

/* ============================================================
   v2: PERSONALISATION (recently viewed, saved, learning, themes)
   ============================================================ */
const Personal={
  recent:[],saved:[],read:{},themes:['AI & Innovation','Dividend Income','Shariah'],lessons:0,
  load(){try{const s=JSON.parse(localStorage.getItem('v22lb')||'{}');Object.assign(this,s);}catch(e){}},
  save(){try{localStorage.setItem('v22lb',JSON.stringify({recent:this.recent,saved:this.saved,read:this.read,themes:this.themes,lessons:this.lessons}));}catch(e){}},
  view(id){this.recent=[id,...this.recent.filter(x=>x!==id)].slice(0,10);this.read[id]=(this.read[id]||0)+1;this.lessons=Object.keys(this.read).length;this.save();},
  saveComparison(id){if(!this.saved.includes(id)){this.saved.unshift(id);this.saved=this.saved.slice(0,8);this.save();toast('Comparison saved');}else{toast('Already saved');}},
  recommend(){
    // recommend next investor by category affinity of recently viewed, excluding seen
    const seen=new Set(this.recent);const cats={};
    this.recent.map(findEntity).filter(Boolean).forEach(e=>{const c=e.cat||e.category||'tradfi';cats[c]=(cats[c]||0)+1;});
    const top=Object.keys(cats).sort((a,b)=>cats[b]-cats[a])[0]||'tradfi';
    let pool=ALL_LEGENDS.filter(e=>!seen.has(e.id));
    const pref=pool.filter(e=>e.cat===top);pool=(pref.length?pref:pool);
    return pool.sort((a,b)=>matchFor(b)-matchFor(a))[0]||ALL_LEGENDS[0];
  },
  learnPct(){return Math.min(100,Math.round(this.lessons/12*100));}
};

/* ============================================================
   v2: DISCOVERY COLLECTIONS
   ============================================================ */
const COLLECTIONS=[
  {key:'featured',tag:"Editor's Pick",nm:'Timeless Compounders',ds:'Quality businesses that grow patiently',g:'linear-gradient(140deg,#0f3d2e,#0a5c3f)',pick:e=>['buffett','smith','bogle','swensen','munger','lynch'].includes(e.id)},
  {key:'beginners',tag:'Best for beginners',nm:'Start Here',ds:'Simple, low-cost, hard to get wrong',g:'linear-gradient(140deg,#123a52,#0e6a8a)',pick:e=>['bogle','sixtyforty','global-core','dividend'].includes(e.id)||e.id==='c2'},
  {key:'retirement',tag:'Best for retirement',nm:'Steady Income',ds:'Lower drawdown, dependable cash flow',g:'linear-gradient(140deg,#3a2a12,#7a5a1e)',pick:e=>['dividend','income-focus','marks','browne','defensive'].includes(e.id)},
  {key:'passive',tag:'Best for passive',nm:'Set And Forget',ds:'Own the market, do nothing well',g:'linear-gradient(140deg,#14324f,#1e5a8a)',pick:e=>['bogle','global-core','sixtyforty','swensen'].includes(e.id)},
  {key:'bear',tag:'Resilient in bear markets',nm:'Storm Proof',ds:'Held up when markets fell hardest',g:'linear-gradient(140deg,#2a1240,#5a1e6a)',pick:e=>['dalio','browne','marks','klarman','defensive','inflation'].includes(e.id)},
  {key:'lowdd',tag:'Lowest drawdown',nm:'Sleep Well',ds:'The gentlest rides in the library',g:'linear-gradient(140deg,#0f2f3f,#0e5a5a)',pick:e=>['browne','klarman','stable-income','low-vol','defensive','c10'].includes(e.id)},
  {key:'shariah',tag:'Best Shariah portfolios',nm:'Faith Aligned',ds:'Fully screened, well diversified',g:'linear-gradient(140deg,#0f3d2e,#0a7a52)',pick:e=>e.shariah},
  {key:'new',tag:'New this month',nm:'Fresh Styles',ds:'Just added to the leaderboard',g:'linear-gradient(140deg,#1a2440,#3a2e6a)',pick:e=>['staking','stable-income','crypto-cons','sustainable','ai-infra'].includes(e.id)}
];
function collItems(c){return [...ALL_LEGENDS,...COMMUNITY,...STRATEGIES].filter(c.pick);}
function collectionsRail(){
  return `<div class="rail" role="list">${COLLECTIONS.map(c=>{const n=collItems(c).length;
    return `<div class="coll" role="listitem" tabindex="0" style="background:${c.g}" onclick="openCollection('${c.key}')" onkeypress="if(event.key==='Enter')openCollection('${c.key}')">
      <span class="cnt">${n}</span><div class="ct"><div class="tag">${esc(c.tag)}</div><div class="nm">${esc(c.nm)}</div><div class="ds">${esc(c.ds)}</div></div></div>`;}).join('')}</div>`;
}
function openCollection(key){
  const c=COLLECTIONS.find(x=>x.key===key);const items=collItems(c);
  const head=`<div class="modal-head"><h3>${esc(c.nm)}</h3><button class="close-x" aria-label="Close" onclick="closeAll()"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>`;
  openModal(head+`<div class="modal-body"><div style="margin:-4px 0 16px"><span class="pill gold">${esc(c.tag)}</span> <span style="color:var(--ink-mute);font-size:13px">${esc(c.ds)} · ${items.length} portfolios</span></div>
    <div class="grid auto-cards">${items.map(e=>e.community?communityCard(e):e.strategy?strategyCard(e):legendCard(e)).join('')}</div></div>`);
}

/* ============================================================
   v2: FLOATING CONTEXTUAL TARA
   ============================================================ */
let _floatT;
const TFloat={
  show(html,actions){
    const f=$('#taraFloat');
    f.innerHTML=`<span class="tara-orb" style="width:26px;height:26px;flex:none"></span><div style="flex:1"><div class="msg">${html}</div>${actions?`<div class="acts">${actions}</div>`:''}</div><button class="fx" aria-label="Dismiss" onclick="TFloat.hide()">×</button>`;
    f.classList.add('show');clearTimeout(_floatT);
    if(!actions)_floatT=setTimeout(()=>this.hide(),9000);
  },
  hide(){$('#taraFloat').classList.remove('show');}
};
// contextual triggers per view
/* Tara no longer auto-interrupts on view changes (decorative AI removed).
   Her genuine, computed insight is available on demand via Ask Tara, and contextually
   inside profiles / Build / Compare where she does real work. */
function taraContext(view){ TFloat.hide(); }

/* ============================================================
   v2: ONBOARDING WALKTHROUGH
   ============================================================ */
const ONB=[
  {ic:'🧭',t:'Welcome to the Investor Leaderboard',d:'This is not copy trading. It is a place to learn from proven investing styles and market legends, then build your own version in three steps.'},
  {ic:'🧬',t:'It knows your Investor DNA',d:'Every recommendation is matched to your risk profile, horizon and holdings. Tara, your AI guide, explains the why behind each one.'},
  {ic:'🛡️',t:'Built for trust',d:'These are educational model portfolios showing similar exposure, never official portfolios or advice. Every metric has a plain-English explanation. Capital is at risk.'}
];
/* Tour-seen flag. This was keyed 'v22onb', which is the key the Onboarding app
   uses for its ENTIRE state object. Standalone that was harmless; merged into the
   Absa shell both apps share one origin, so finishing this tour wrote '1' over
   onboarding's state and silently reset it. Namespaced to keep them apart. */
const Onboard={i:0,
  start(force){try{if(!force&&localStorage.getItem('absa_lb_tour')==='1')return;}catch(e){}this.i=0;this.render();},
  render(){const s=ONB[this.i];
    openModal(`<div class="modal-body coach-card"><div class="coach-illus">${s.ic}</div>
      <h2 style="font-size:23px;margin-bottom:10px">${esc(s.t)}</h2>
      <p style="color:var(--ink-soft);font-size:15px;line-height:1.6;max-width:380px;margin:0 auto">${esc(s.d)}</p>
      <div class="coach-dots">${ONB.map((_,i)=>`<span class="${i===this.i?'on':''}"></span>`).join('')}</div>
      <div style="display:flex;gap:10px;justify-content:center">
        ${this.i>0?`<button class="btn btn-ghost" onclick="Onboard.back()" aria-label="Back to previous step">Back</button>`:''}
        <button class="btn btn-ghost" onclick="Onboard.done()">Skip</button>
        <button class="btn btn-primary" onclick="Onboard.next()">${this.i<ONB.length-1?'Next':'Explore'}</button>
      </div></div>`);
  },
  next(){if(this.i<ONB.length-1){this.i++;this.render();}else this.done();},
  back(){if(this.i>0){this.i--;this.render();}},
  done(){try{localStorage.setItem('absa_lb_tour','1');}catch(e){}closeAll();TFloat.show('<b>You are all set.</b> I will surface insights as you explore. Tap me anytime.','');}
};

/* ============================================================
   v2: SUCCESS + CELEBRATION
   ============================================================ */
function celebrate(){
  const box=el('<div class="confetti"></div>');const cols=['#00E0A0','#7C6CFF','#4FC3F7','#E7C27D','#FF7A9A'];
  for(let i=0;i<70;i++){const c=el('<i></i>');const seedr=rng(i*97+3);c.style.left=(seedr()*100)+'%';c.style.background=cols[i%cols.length];c.style.animationDuration=(1.6+seedr()*1.6)+'s';c.style.animationDelay=(seedr()*0.5)+'s';c.style.transform='rotate('+(seedr()*360)+'deg)';box.appendChild(c);}
  document.body.appendChild(box);setTimeout(()=>box.remove(),3600);
}
function successModal(title,msg){
  openModal(`<div class="modal-body" style="text-align:center;padding:40px 26px">
    <svg class="success-check" viewBox="0 0 84 84" fill="none"><circle cx="42" cy="42" r="38" stroke="#34D399" stroke-width="4"/><path d="M25 43l12 12 22-24" stroke="#34D399" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <h2 style="font-size:22px;margin:14px 0 8px">${esc(title)}</h2>
    <p style="color:var(--ink-soft);max-width:360px;margin:0 auto 20px;line-height:1.6">${esc(msg)}</p>
    <button class="btn btn-primary" onclick="closeAll()">Done</button></div>`);
}

/* ============================================================
   v2: ACCESSIBILITY - focus trap for modal
   ============================================================ */
let _lastFocus=null;
const _origOpenModal=openModal;
openModal=function(html){const _anyBefore=_anyOverlay();_lastFocus=document.activeElement;_origOpenModal(html);const m=$('#modal');requestAnimationFrame(()=>{const f=m.querySelector('button,[href],input,[tabindex]');if(f)f.focus();initCharts(m);});if(!_anyBefore)_routePushModal();};
const _origCloseAll=closeAll;
closeAll=function(){_origCloseAll();if(_lastFocus&&_lastFocus.focus){try{_lastFocus.focus();}catch(e){}}if(history.state&&history.state.o){try{history.back();}catch(e){}}};

/* ============================================================
   HISTORY: keep browser Back inside the app (navigate views / close modals) instead of leaving the prototype
   ============================================================ */
let _rSuppress=false,_rInit=false;
function _anyOverlay(){return document.getElementById('modal').classList.contains('show')||document.getElementById('taraPanel').classList.contains('show')||document.getElementById('sidebar').classList.contains('open')||(typeof Notifs!=='undefined'&&Notifs.open);}
function _routeReplace(){try{history.replaceState({v:App.view},'', '#'+App.view);_rInit=true;}catch(e){_rInit=true;}}
function _routePushView(){if(_rSuppress||!_rInit)return;try{if(history.state&&history.state.v===App.view&&!history.state.o)return;history.pushState({v:App.view},'', '#'+App.view);}catch(e){}}
function _routePushModal(){if(!_rInit)return;try{history.pushState({v:App.view,o:1},'', '#'+App.view);}catch(e){}}
window.addEventListener('popstate',()=>{
  if(_anyOverlay()){closeAll();toggleNav(false);if(typeof Notifs!=='undefined')Notifs.close();return;}
  const v=(history.state&&history.state.v)||'foryou';
  _rSuppress=true;try{if(App.view!==v)App.go(v);}finally{_rSuppress=false;}
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;const m=$('#modal');if(!m.classList.contains('show'))return;
  const f=[...m.querySelectorAll('button,[href],input,select,[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);
  if(!f.length)return;const first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});

/* ============================================================
   boot
   ============================================================ */
document.addEventListener('DOMContentLoaded',()=>{Personal.load();App.init();_routeReplace();
  /* onboarding shows once per browser; append ?tour (or ?tour=1) to the URL to replay it on demand */
  const forceTour=/[?&]tour\b/i.test(location.search);
  setTimeout(()=>Onboard.start(forceTour),400);
});
