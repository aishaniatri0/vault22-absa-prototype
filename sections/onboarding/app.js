/* ============================================================================
   Vault22 Onboarding Prototype, application engine
   Implements ONBOARDING-PLAN-SHARE-2026-07-07.md in specification order.
   Desktop web, natural extension of the live Vault22 web app.
   Built incrementally: Section 1 (login/region/about) first, then fork,
   journeys, connect, dashboard. Each section audited against the spec.
   ============================================================================ */

/* ---------------------------------------------------------------- state */
const DEFAULT_STATE = {
  // account / identity
  email:'', authMethod:'', name:'', dob:'', age:null,
  // market (Section 1 region)
  region:'',            // 'SA' | 'UAE' | 'GLOBAL'
  // about-you
  household:'', confidence:'',
  lifeStage:'',         // derived
  // fork (Section 2)
  picks:[],             // tap-ordered intent keys, max 3
  // shared / cross-journey (Section 6, ask once)
  income:null, incomeVaries:false,
  budgetStyle:'', risk:null, riskBand:null, goal:null, plan:null,
  _resume:null,        // {key,step,fromDash,picIndex} so a mid-journey reload resumes
  // journey intake answers
  answers:{},           // { spending:{q1,q2}, health:{...}, debt:{...}, ... }
  // connect
  linked:false, linkMethod:'', linkedAccounts:[],
  // dashboard feed flags (which zones have real data)
  fed:{},               // { yourMoney:true, whereItGoes:true, ... }
  // progress
  onboardingComplete:false,
  metTara:false,        // first-use Meet-Tara hand-off shown (Appendix B #7)
};
let state = load();
function load(){
  try{ const s = JSON.parse(localStorage.getItem('v22onb')); return s? {...structuredClone(DEFAULT_STATE),...s}:structuredClone(DEFAULT_STATE); }
  catch(e){ return structuredClone(DEFAULT_STATE); }
}
function save(){ localStorage.setItem('v22onb', JSON.stringify(state)); }
function resetAll(){ state = structuredClone(DEFAULT_STATE); save(); go('login'); }

/* ---------------------------------------------------------------- market context (Section 1 / 0 scope note) */
const MARKETS = {
  SA:     {label:'South Africa', cur:'R', curName:'ZAR', drawn:true},
  UAE:    {label:'United Arab Emirates', cur:'AED ', curName:'AED', drawn:false},
  GLOBAL: {label:'Global', cur:'$', curName:'USD', drawn:false},
};
function market(){ return MARKETS[state.region] || MARKETS.SA; }
function cur(n){ const m=market(); return m.cur + Number(n).toLocaleString('en-ZA'); }
/* Currency prefix for hero numbers: keep a space after multi-letter symbols (AED 3 115),
   none needed after a single glyph (R4 820 / $5). */
function curPrefix(){ const s=(market().cur||'').trim(); return s.length>1 ? s+' ' : s; }
function isConfirmedMarket(){ return market().drawn; } // SA fully drawn; others [to confirm]

/* ---------------------------------------------------------------- intents (Section 2) */
const INTENTS = [
  {key:'understand', n:1, label:'Understand my finances',        sub:'Show me my money',                journey:'J-Understand', zone:'yourMoney',  icon:'eye'},
  {key:'spending',   n:2, label:'Get control of my spending',    sub:'Get a grip on where money goes',  journey:'J-Spending',   zone:'whereItGoes',icon:'wallet'},
  {key:'health',     n:3, label:'Improve my financial health',   sub:'Your Financial Fitness Score',    journey:'J-Health',     zone:'fitness',    icon:'heart', flagship:true},
  {key:'debt',       n:4, label:'Get out of debt',               sub:'Understand it, get a way out',    journey:'J-Debt',       zone:'whatYouOwe', icon:'chain'},
  {key:'wealth',     n:5, label:'Grow my wealth',                sub:'Invest toward growth',            journey:'J-Wealth',     zone:'yourWealth', icon:'trend'},
  {key:'save',       n:6, label:'Save for a goal',               sub:'Reach a specific goal',           journey:'J-Save',       zone:'aimingFor',  icon:'target'},
  {key:'retirement', n:7, label:'Plan for retirement',           sub:'Know if you are on track',        journey:'J-Retirement', zone:'aimingFor',  icon:'palm'},
];
function intent(k){ return INTENTS.find(i=>i.key===k); }
function primaryPick(){ return state.picks[0] || 'understand'; } // Understand = no-priority default
/* date helpers, future-only guards */
function todayISO(){ const t=new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; }
function curMonthISO(){ return todayISO().slice(0,7); }

/* ---------------------------------------------------------------- analytics (Appendix E) */
const _log = [];
function track(evt, params){
  const line = evt + (params? ' '+JSON.stringify(params):'');
  _log.push(line); if(_log.length>60)_log.shift();
  const el = document.querySelector('.devlog'); if(el) el.textContent = '▸ '+line;
  console.log('[analytics]', evt, params||{});
}

/* ---------------------------------------------------------------- icons */
function icon(name, cls){
  const P = {
    eye:'<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>',
    wallet:'<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.4"/>',
    heart:'<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z"/>',
    chain:'<path d="M9 12a3 3 0 0 1 3-3h3a3 3 0 0 1 0 6h-1.5"/><path d="M15 12a3 3 0 0 1-3 3H9a3 3 0 0 1 0-6h1.5"/>',
    trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    palm:'<path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6-1 4-3 6-7 6z"/><path d="M12 13c0-4-3-6-7-6 1 4 3 6 7 6z"/>',
    back:'<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    check:'<path d="M20 6L9 17l-5-5"/>',
    shield:'<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/>',
    lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    bank:'<path d="M3 10l9-6 9 6"/><path d="M4 10v9M20 10v9M9 10v9M15 10v9"/><path d="M2 21h20"/>',
    doc:'<path d="M14 3v5h5"/><path d="M7 3h8l5 5v13H7z"/><path d="M9 13h6M9 17h6"/>',
    coins:'<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v6c0 1.7 2.7 3 6 3s6-1.3 6-3"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
    home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chart:'<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8"/><rect x="12" y="6" width="3" height="12"/><rect x="17" y="13" width="3" height="5"/>',
    chat:'<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    family:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M15.5 20a5 5 0 0 1 5.5-4.6"/>',
    crypto:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5h4a2.2 2.2 0 0 1 0 4.4h-4z"/><path d="M9.5 12.9h4.3a2.2 2.2 0 0 1 0 4.4H9.5z"/><path d="M11 7v10M13 7v10"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    chevDown:'<path d="M6 9l6 6 6-6"/>',
    chevLeft:'<path d="M15 18l-6-6 6-6"/>',
    chevRight:'<path d="M9 6l6 6-6 6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ic ${cls||''}">${P[name]||''}</svg>`;
}

/* ---------------------------------------------------------------- derive life-stage (Section 1: derived, not asked) */
function deriveLifeStage(){
  const a = state.age, h = parseInt(state.household);
  if(a==null) return '';
  if(a<24) return 'Student';
  if(a>=60) return 'Retired';
  if(h>=3 && a<50) return 'Growing family';
  if(a>=45) return 'Established professional';
  return 'Early career';
}

/* ============================================================================
   SHELL + ROUTER
   ============================================================================ */
const root = () => document.getElementById('root');
let current = 'login';
function go(screen, opts){
  if(!SCREENS[screen]){ // safety net: never silently dump to Login on a bad key
    console.warn('[router] unknown screen "'+screen+'", staying put');
    return;
  }
  // A modal belongs to the screen it was opened from; a real navigation dismisses it
  // so it can never survive as a dead overlay on the next screen.
  const mr = document.getElementById('modal-root'); if(mr) mr.innerHTML=''; if(typeof CONNECT!=='undefined') CONNECT=null;
  closeSettings(); if(typeof closeFactSheet==='function') closeFactSheet(); if(typeof RISKQUIZ!=='undefined') RISKQUIZ=null;
  // Leaving a journey for any other screen ends the resumable session.
  if(screen!=='journey' && state && state._resume){ state._resume=null; save(); }
  current = screen; render(opts); window.scrollTo(0,0);
}
function render(opts){
  const fn = SCREENS[current] || SCREENS.login;
  root().innerHTML = fn(opts||{});
  bindDev();
  if(SCREEN_AFTER[current]) SCREEN_AFTER[current](opts||{});
}
const SCREEN_AFTER = {}; // optional post-render hooks per screen

/* onboarding split-screen shell */
function onbShell({body, step, segs, back, logo}){
  const brand = `
    <div class="onb__brand">
      <svg class="bmark" viewBox="0 0 64 64" aria-hidden="true"><use href="#v22mark-white"/></svg>
      <div class="bword">Absa</div>
      <div class="brand-tagline">One place for your whole financial life, read back to you by Tara, your AI money coach.</div>
      <div class="shareholders">
        <div class="sh-label">Our Shareholders</div>
        <div class="sh-row"><span>SC Ventures</span><span>Old Mutual</span><span>Franklin Templeton</span></div>
      </div>
    </div>`;
  const progress = segs ? `<div class="progress">
      ${[0,1,2].map(i=>`<div class="seg ${i<segs.done?'done':''} ${i===segs.done&&segs.half?'half':''}"></div>`).join('')}
      <span class="label">${segs.label}</span>
    </div>` : '';
  const logoBlock = logo!==false ? `
    <div class="onb__logo">
      <svg class="mark" viewBox="0 0 64 64"><use href="#v22mark"/></svg>
      <h1>Welcome to Absa</h1>
      <div class="sub">Your all-in-one smart finance app which is intelligent, simple, and personalized for you</div>
    </div>` : '';
  return `<div class="onb">
    <div class="onb__form">
      <div class="onb__top">${back?`<button class="back-btn" aria-label="Go back" onclick="${back}">${icon('back')}</button>`:''}</div>
      <div class="onb__formwrap">
        ${logoBlock}${progress}${body}
      </div>
    </div>
    ${brand}
  </div>${devbar()}`;
}

/* ============================================================================
   SECTION 1, Shared, before the fork
   ============================================================================ */
window.SCREENS = window.SCREENS || {};
var SCREENS = window.SCREENS;

/* 1.1 Login, first screen, nothing else. Google or email. */
SCREENS.login = () => {
  return onbShell({
    segs:null,
    body:`
      <h2 class="screen-title" style="margin-top:22px">Get started</h2>
      <div class="field" style="margin-top:12px">
        <label>Email ID</label>
        <input class="input" id="f-email" type="email" placeholder="johndoe@gmail.com" value="${state.email||''}" oninput="state.email=this.value">
      </div>
      <div class="field">
        <label>Password</label>
        <input class="input" id="f-pass" type="password" placeholder="Enter your password">
      </div>
      <div class="legalnote">By clicking on continue you agree to our <a onclick="legalDoc('Terms and conditions')">Terms and conditions</a> and okay with our <a onclick="legalDoc('Privacy Policy')">Privacy</a></div>
      <div class="actions">
        <button class="btn btn-primary" onclick="loginEmail()">Continue</button>
      </div>
      <div class="or">or</div>
      <div class="actions">
        <button class="btn btn-ghost" onclick="loginGoogle()">${googleG()} Continue with Google</button>
        <button class="btn btn-ghost" onclick="loginApple()">${appleA()} Continue with Apple ID</button>
      </div>
      <div class="center-link" style="margin-top:18px">New here? Continue to <a onclick="startNew()">create your account</a></div>
      ${consentNote()}
    `
  });
};
function consentNote(){ // Section 5A: no onboarding consent step, captured at signup/link. Surfaced as intentional.
  return `<div class="pill-note" style="margin:16px auto 0;display:flex">${icon('info')} Consent is captured here at sign-up, no separate consent step later (POPIA)</div>`;
}
function loginEmail(){ if(!state.email){ shake('f-email'); return;} state.authMethod='email'; track('onboarding_started',{region:state.region||null}); save(); go('region'); }
function loginGoogle(){ state.authMethod='google'; state.email=state.email||'aishani@gmail.com'; state.name='Aishani'; track('onboarding_started',{region:null}); save(); go('region'); }
function loginApple(){ state.authMethod='apple'; state.email=state.email||'user@icloud.com'; track('onboarding_started',{region:null}); save(); go('region'); }
function startNew(){ state.authMethod='email'; track('onboarding_started',{region:null}); save(); go('region'); }

/* 1.2 Region / market, right after login. Sets currency, providers, KYC, products downstream.
   Also reused as an in-app region switcher (edit mode) from the dashboard, which returns
   to the dashboard instead of continuing onboarding. */
SCREENS.region = (opts0) => {
  const edit = !!(opts0 && opts0.edit) || (state.onboardingComplete && !(opts0 && opts0.onboarding));
  const opts = [
    {k:'SA',     t:'South Africa',            d:'Rand (ZAR) · local banks and products'},
    {k:'UAE',    t:'United Arab Emirates',    d:'Dirham (AED) · regional providers'},
    {k:'GLOBAL', t:'Global / other',          d:'Set your currency and providers'},
  ];
  return onbShell({
    back: edit ? "go('dashboard')" : "go('login')",
    segs: edit ? null : {done:1, label:'1 / 3'},
    logo:false,
    body:`
      <div class="onb__logo" style="margin-top:6px"><svg class="mark" viewBox="0 0 64 64"><use href="#v22mark"/></svg></div>
      <h2 class="screen-title">${edit?'Change your region':'Select your region'}</h2>
      <div class="screen-sub">Your banking location and preferred investment region. This sets your currency, which banks and providers you can link, your KYC checks and the products you'll see.</div>
      <div class="opt-list">
        ${opts.map(o=>`
          <button class="opt ${state.region===o.k?'sel':''}" onclick="pickRegion('${o.k}',${edit})">
            <span class="opt-ic">${flagFor(o.k)}</span>
            <span class="opt-body"><span class="opt-t">${o.t}</span><span class="opt-d">${o.d}</span></span>
            <span class="opt-check">${icon('check')}</span>
          </button>`).join('')}
      </div>
      ${state.region && !isConfirmedMarket() ? `<div class="callout flag">${icon('info')} Great, we'll set Absa up for ${market().label}. The flow and dashboard work the same everywhere; a few local figures stay indicative until you link your accounts.</div>`:''}
      ${edit?'':`<div class="legalnote">By clicking on continue you agree to our <a onclick="legalDoc('Terms and conditions')">Terms and conditions</a> and okay with our <a onclick="legalDoc('Privacy Policy')">Privacy</a></div>`}
      <div class="actions"><button class="btn btn-primary" ${state.region?'':'disabled'} onclick="${edit?'afterRegionEdit()':'afterRegion()'}">${edit?'Save region':'Continue'}</button></div>
      ${edit?'':`<div class="center-link small">${icon('info',' ')} You can change your region later.</div>`}
    `
  });
};
function editRegion(){ go('region',{edit:true}); }
function afterRegionEdit(){ if(!state.region) return; track('region_changed',{region:state.region}); save(); go('dashboard'); }
function pickRegion(k, edit){ state.region=k; save(); go('region', edit?{edit:true}:{}); }
function afterRegion(){ if(!state.region) return; track('region_selected',{region:state.region}); save(); go('about'); }

/* 1.3 About you, name, age/dob, household (opt), confidence (opt). Country NOT re-asked. Life-stage derived. */
SCREENS.about = () => {
  const conf = ['Very confident','Somewhat confident','Not very confident','Stressed'];
  const hh = ['1','2','3','4','5+'];
  return onbShell({
    back:"go('region')",
    segs:{done:2, label:'2 / 3'},
    logo:false,
    body:`
      <div class="onb__logo" style="margin-top:6px"><svg class="mark" viewBox="0 0 64 64"><use href="#v22mark"/></svg></div>
      <h2 class="screen-title">A little about you</h2>
      <div class="screen-sub">Just enough to size everything honestly. One short page.</div>
      ${trustLine('About you')}
      <div class="field">
        <label>Name <span class="hint">· confirm</span></label>
        <input class="input" id="a-name" placeholder="Your name" value="${state.name||''}" oninput="state.name=this.value">
      </div>
      <div class="field">
        <label>Date of birth <span class="hint">· required</span></label>
        <input class="input" id="a-dob" aria-label="Date of birth" type="date" value="${state.dob||''}" oninput="onDob(this.value)">
        <div id="dob-msg" class="hint" style="margin-top:6px"></div>
      </div>
      <div class="field">
        <label>Household size <span class="hint">· optional, sizes your emergency fund & cover</span></label>
        <div class="chips" id="hh-chips">
          ${hh.map(h=>`<button class="chip ${state.household===h?'sel':''}" onclick="setHH('${h}')">${h}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>How do you feel about your finances? <span class="hint">· optional</span></label>
        <div class="chips" id="conf-chips">
          ${conf.map(c=>`<button class="chip ${state.confidence===c?'sel':''}" onclick="setConf('${c}')">${c}</button>`).join('')}
        </div>
      </div>
      <div id="ls-note"></div>
      <div class="actions" style="margin-top:16px"><button class="btn btn-primary" onclick="afterAbout()">Continue</button></div>
    `
  });
};
SCREEN_AFTER.about = () => {
  const d=document.getElementById('a-dob');
  if(d){ const t=new Date(); const iso=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; d.max=iso; }
  if(state.dob) onDob(state.dob); updateLsNote();
};
function onDob(v){
  state.dob=v;
  const msg=document.getElementById('dob-msg');
  if(!v){ state.age=null; if(msg)msg.textContent=''; updateLsNote(); return; }
  const d=new Date(v), now=new Date();
  let age=now.getFullYear()-d.getFullYear();
  if(now< new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  state.age=age;
  if(msg){ msg.textContent=''; }
  updateLsNote(); save();
}
function setHH(h){ state.household=h; save(); document.querySelectorAll('#hh-chips .chip').forEach(c=>c.classList.toggle('sel',c.textContent===h)); updateLsNote(); }
function setConf(c){ state.confidence=c; save(); document.querySelectorAll('#conf-chips .chip').forEach(x=>x.classList.toggle('sel',x.textContent===c)); }
function updateLsNote(){
  const ls=deriveLifeStage(); state.lifeStage=ls;
  const el=document.getElementById('ls-note'); if(!el) return;
  el.innerHTML = ls ? `<div class="ls-pill" style="margin-top:8px">${icon('spark')} <span>Life-stage <b>${ls}</b></span> <span class="ls-sub">we work this out for you</span></div>` : '';
}
function afterAbout(){
  if(!state.name){ shake('a-name'); return; }
  if(!state.dob){ shake('a-dob'); return; }
  state.lifeStage=deriveLifeStage();
  track('about_you_completed',{has_age:!!state.dob, has_household:!!state.household, confidence:state.confidence||null});
  save(); go('fork');
}

/* ---------------------------------------------------------------- shared: trust line (Section 5) */
function trustLine(context){
  return `<div class="trust">${icon('lock')}<div>Your data is read-only and encrypted; credentials go straight to your provider, never to us.
    <span class="trust-more" onclick="expandTrust(this)">How we protect you ›</span></div></div>`;
}
function expandTrust(el){
  el.closest('.trust').outerHTML = `<div class="trust-panel">
    <b style="color:var(--v-green-700)">${''}How Absa protects you</b>
    <ul>
      <li>${icon('shield')} Read-only access, we can see balances and transactions, never move money.</li>
      <li>${icon('lock')} Bank-grade encryption in transit and at rest.</li>
      <li>${icon('bank')} Credentials are entered with your provider, never stored by Absa.</li>
      <li>${icon('refresh')} You can disconnect any account at any time.</li>
    </ul>
    <div class="hint" style="margin-top:10px">Exact security wording to be finalised.</div>
  </div>`;
}

/* ---------------------------------------------------------------- little helpers */
function shake(id){ const el=document.getElementById(id); if(!el)return; el.style.borderColor='var(--red)';
  el.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:250}); el.focus(); }
function googleG(){ return `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-7.8z"/><path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M6 14.4a6.6 6.6 0 0 1 0-4.2V7.4H2.3a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.5c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 12 1a11 11 0 0 0-9.7 6l3.7 2.8c.9-2.5 3.2-4.3 6-4.3z"/></svg>`; }
function appleA(){ return `<svg width="17" height="17" viewBox="0 0 24 24" fill="#111"><path d="M16.4 12.9c0-2.6 2.1-3.8 2.2-3.9-1.2-1.7-3-1.9-3.7-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.3 1-4.1 2.5-1.8 3-.5 7.6 1.2 10 .8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.5.6-.9.9-1.4 1.4-2.4-3.6-1.4-2.4-4.7-2.4-4.8zM14 5.9c.7-.8 1.1-2 1-3.1-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.8-1.3z"/></svg>`; }
function flagFor(k){ const map={SA:'🇿🇦',UAE:'🇦🇪',GLOBAL:'🌍'}; return `<span style="font-size:20px">${map[k]||'🌍'}</span>`; }

/* ---------------------------------------------------------------- dev toolbar (prototype aid) */
/* Single unobtrusive Prototype Settings button, opens a drawer. Not part of the product. */
function devbar(){ return `<button class="proto-fab" title="Prototype settings" onclick="openSettings()">${icon('settings')}</button>`; }
function bindDev(){ /* reserved */ }
function openSettings(){
  if(document.getElementById('proto-scrim')) return;
  closeOtherOverlays();
  const nav = [
    ['login','Login','back'],['region','Region','info'],['about','About you','info'],['fork','The fork','grid'],['dashboard','Dashboard','home']
  ];
  const journeys = [
    ['understand','Understand'],['spending','Spending'],['health','Health'],['debt','Debt'],['wealth','Wealth'],['save','Save'],['retirement','Retirement']
  ];
  const el=document.createElement('div');
  el.innerHTML = `
    <div class="proto-scrim" id="proto-scrim" onclick="closeSettings()"></div>
    <aside class="proto-drawer" role="dialog" aria-label="Prototype settings">
      <div class="pd-head">
        <div class="pd-badge">${icon('settings')}</div>
        <div><div class="pd-title">Prototype settings</div><div class="pd-sub">Internal tool · not part of the product</div></div>
        <button class="pd-close" onclick="closeSettings()" aria-label="Close">✕</button>
      </div>
      <div class="proto-body">
        <div class="proto-sec"><div class="ps-label">Demo presets</div>
          <div class="proto-grid">
            <button class="proto-btn demo wide" onclick="loadDemoA();closeSettings()">${icon('wallet')} Demo A, budgeting, no link (income-only)</button>
            <button class="proto-btn demo wide" onclick="loadDemoB();closeSettings()">${icon('grid')} Demo B, multi-select, linked</button>
          </div></div>
        <div class="proto-sec"><div class="ps-label">Jump to a screen</div>
          <div class="proto-grid">
            ${nav.map(([s,l,ic])=>`<button class="proto-btn" onclick="go('${s}');closeSettings()">${icon(ic)} ${l}</button>`).join('')}
          </div></div>
        <div class="proto-sec"><div class="ps-label">Start a journey (from the fork's #1 pick)</div>
          <div class="proto-grid">
            ${journeys.map(([k,l])=>`<button class="proto-btn" onclick="protoStartJourney('${k}')">${icon(intent(k).icon)} ${l}</button>`).join('')}
          </div></div>
        <div class="proto-sec"><div class="ps-label">Reset</div>
          <div class="proto-grid">
            <button class="proto-btn danger wide" onclick="resetAll();closeSettings()">${icon('refresh')} Reset prototype to the start</button>
          </div></div>
      </div>
      <div class="proto-foot">Absa Onboarding Prototype · figures are illustrative. This panel is for the review team only and would not ship.</div>
    </aside>`;
  el.id='proto-overlay'; document.body.appendChild(el);
}
function closeSettings(){ const o=document.getElementById('proto-overlay'); if(o) o.remove(); }
function protoStartJourney(k){ // set up minimal state so the journey can run, then start it
  if(!state.region) state.region='SA'; if(!state.name) state.name='Aishani'; if(!state.age){state.age=33;state.dob='1992-01-01';}
  state.picks=[k]; save(); closeSettings(); startJourney(k);
}
/* demo presets (real versions defined with the dashboard, Section 3) */

/* ============================================================================
   SECTION 2, The fork (1 screen, intent-framed)
   Question: "What would you like Tara to help you with today?"
   Tick up to 3; tap-order = priority (first = #1); no separate ranking step.
   Understand = the no-priority default (tick nothing -> lands there).
   Only the #1 pick's intake runs; #2/#3 resolve on the dashboard (Section 3.3).
   ============================================================================ */
SCREENS.fork = () => {
  return onbShell({
    back:"go('about')",
    segs:{done:3, label:'3 / 3'},
    logo:false,
    body:`
      <div class="onb__logo" style="margin-top:6px"><svg class="mark" viewBox="0 0 64 64"><use href="#v22mark"/></svg></div>
      <h2 class="screen-title">What would you like Tara to help you with today?</h2>
      <div class="screen-sub">Pick up to three. The order you tap sets your priority, and we'll walk you through each one to set it up.</div>
      <div class="opt-list" id="fork-list">
        ${INTENTS.map(it=>forkCard(it)).join('')}
      </div>
      <div id="plan-tray">${planTray()}</div>
      <button class="callout explore-callout explore-btn" onclick="explorePlatform()">${icon('info')}<span><b>I want to explore the platform.</b> Show me my money first, with <b>Understand my finances</b> as my starting point.</span>${icon('chevRight','ex-chev')}</button>
      <div class="actions" style="margin-top:12px">
        <button class="btn btn-primary" onclick="afterFork()" id="fork-cta">${forkCtaLabel()}</button>
      </div>
    `
  });
};
function forkCard(it){
  const idx = state.picks.indexOf(it.key);
  const sel = idx>=0;
  const disabled = !sel && state.picks.length>=3;
  return `<button class="opt ${sel?'sel':''}" ${disabled?'style="opacity:.45;pointer-events:none"':''} onclick="togglePick('${it.key}')">
    <span class="opt-ic">${icon(it.icon)}</span>
    <span class="opt-body">
      <span class="opt-t">${it.label}</span>
      <span class="opt-d">${it.sub}</span>
    </span>
    <span class="opt-rank">${sel?idx+1:''}</span>
    <span class="opt-check">${icon('check')}</span>
  </button>`;
}
function forkCtaLabel(){
  if(state.picks.length===0) return 'Continue with Understand my finances';
  const first = intent(state.picks[0]);
  return `Continue with ${first.label}` + (state.picks.length>1?` +${state.picks.length-1} more`:'');
}
function togglePick(k){
  const i = state.picks.indexOf(k);
  if(i>=0) state.picks.splice(i,1);
  else { if(state.picks.length>=3) return; state.picks.push(k); }
  save();
  // re-render just the list + cta (keep scroll)
  const list=document.getElementById('fork-list'); if(list) list.innerHTML = INTENTS.map(it=>forkCard(it)).join('');
  const cta=document.getElementById('fork-cta'); if(cta) cta.textContent = forkCtaLabel();
  const tray=document.getElementById('plan-tray'); if(tray) tray.innerHTML = planTray();
}
function planTray(){
  if(!state.picks.length) return `<div class="plan-tray"><div class="pt-head">${icon('spark')} Your plan</div>
    <div class="pt-empty">Tap what matters most. We'll walk you through each pick, in the order you choose, to set it up.</div></div>`;
  return `<div class="plan-tray has"><div class="pt-head">${icon('spark')} Your plan · in priority order</div>
    ${state.picks.map((k,i)=>{const it=intent(k);return `<div class="plan-row">
      <span class="pr-rank ${i>0?'sec':''}">${i+1}</span>
      <span class="pr-t">${it.label}</span>
      <span class="pr-tag">${i===0?'we start here':'then this'}</span></div>`;}).join('')}</div>`;
}
/* "I want to explore the platform" — an explicit clickable option: skip choosing,
   go straight in led by Understand my finances. */
function explorePlatform(){ state.picks=[]; save(); track('focus_chosen',{interests:['understand'],count:0,explore:true}); afterFork(); }
function afterFork(){
  // no-priority default: tick nothing -> Understand
  const picks = state.picks.length? state.picks.slice() : ['understand'];
  state.picks = picks;
  track('focus_chosen',{interests:picks, count:picks.length});
  save();
  // Onboarding runs the #1 pick's intake only.
  routeToPrimaryIntake();
}
function routeToPrimaryIntake(){
  // Resume at the first pick whose intake isn't already satisfied, so returning to
  // the fork mid-walkthrough (e.g. via Back) continues where you were rather than
  // restarting from pick #1. Fresh from the fork, nothing is satisfied so this is #1.
  const ni = (typeof nextUnrunPick==='function') ? nextUnrunPick(0) : 0;
  if(ni<0){ landDashboard(); return; }
  startJourney(state.picks[ni], {picIndex:ni});
}

/* ============================================================================
   SECTION 5, Shared components
   Connect (one component, three methods) + trust layer + link-removes-manual.
   Connect is pushed hard + GATED in budgeting; encouraged elsewhere.
   Failure posture (App D): retry once, then offer the no-link fallback.
   ============================================================================ */

/* SA banks (market-specific). Capitec = do NOT show as available until confirmed. */
const BANKS_SA = [
  {n:'Standard Bank', c:'#0033a0'}, {n:'FNB', c:'#00a19a'}, {n:'Absa', c:'#dc0032'},
  {n:'Nedbank', c:'#006a4d'}, {n:'Discovery Bank', c:'#0033a1'}, {n:'TymeBank', c:'#ffcc00'},
  {n:'Investec', c:'#00304f'}, {n:'African Bank', c:'#0a4c96'},
  {n:'Capitec', c:'#c8102e', disabled:true}, // [to confirm]
];
const BANKS_TC = [{n:'Your bank', c:'#334155'}]; // UAE/global provider set [to confirm]

// active connect context
let CONNECT = null; // {journey, gated, quietLabel, onDone, step, retry, chosenBank}

// Capitec is intentionally NOT selectable: spec "Open items" says do not show it as
// available until confirmed. Shown disabled for transparency.
const BANKS=['FNB','Standard Bank','Nedbank','Absa','Discovery Bank','TymeBank','Investec'];
const BANKS_DISABLED=['Capitec (coming soon)'];
const ACCT_TYPES=['Savings','Fixed Deposit','Call','Transmission','Cheque'];
function openConnect({journey, gated, quietLabel, onDone}){
  closeOtherOverlays();
  CONNECT = {journey, gated:!!gated, quietLabel:quietLabel||'Give us a few numbers instead', onDone, step:'intro', retry:0, chosenBank:null, failure:null};
  renderConnect();
}
function closeConnect(){ document.getElementById('modal-root').innerHTML=''; CONNECT=null; }
function renderConnect(){
  const mr=document.getElementById('modal-root'); if(!CONNECT){ mr.innerHTML=''; return; }
  mr.innerHTML = `<div class="modal-back"><div class="modal">${connectBody()}</div></div>`;
}
function connectBody(){
  const c=CONNECT;
  if(c.step==='intro')    return connectIntro();
  if(c.step==='form')     return connectForm();
  if(c.step==='verify')   return connectVerify();
  if(c.step==='done')     return connectDone();
  if(c.step==='failure')  return connectFailure();
  if(c.step==='income')   return connectIncome();
  if(c.step==='statement')return connectStatement();
  return '';
}
/* Vault22 Connect, the established flow reused from the Budget prototype's openLinkFlow:
   intro (value props) -> add bank account details -> verify -> success. */
function connectIntro(){
  const c=CONNECT;
  return `<div class="modal-head">
      <div class="mi">${icon('bank')}</div>
      <div><div class="mh-t">Link an account</div>
      <div class="md muted small">${c.gated?'The real budget <b>is</b> your transaction feed, this is the primary path.':'Connecting an account lets Absa build and track everything automatically.'}</div></div>
      <button class="mh-close" aria-label="Close" onclick="closeConnect()">✕</button>
    </div>
    <div class="modal-body">
      <div class="connect-props">
        ${[['lock','Bank-grade, read-only','We can see transactions to categorise them. We can never move money.'],
           ['clock','Set up in about 60 seconds','Your account is verified and your picture is built instantly.'],
           ['spark','Tara does the work','Spending is sorted and insights appear automatically.']].map(x=>
          `<div class="cprop"><span class="cp-ic">${icon(x[0])}</span><div><div class="cp-t">${x[1]}</div><div class="cp-d">${x[2]}</div></div></div>`).join('')}
      </div>
      <div class="actions"><button class="btn btn-primary" onclick="connectStep('form')">${icon('bank')} Add account details</button></div>
      <div class="connect-alt"><button class="btn-link" onclick="connectStep('statement')">Forward a statement</button><span class="dotsep">·</span><button class="btn-link" onclick="connectStep('income')">Just enter my income</button></div>
      ${c.gated? `<div class="callout" style="margin-top:8px">${icon('info')} Budgeting needs at least one of these, a linked account <b>or</b> the quick numbers. You won't be left with nothing.</div>`
               : `<div class="center" style="margin-top:6px"><button class="btn-link" onclick="connectFallbackNow()">Not now ›</button></div>`}
    </div>`;
}
/* Add bank account details, live Vault22 form (Bank Name, Account Number, Account Type) */
function connectForm(){
  const tc=!isConfirmedMarket();
  return `<div class="modal-head">
      <button class="mh-close" aria-label="Back" style="margin-left:0;margin-right:6px" onclick="connectStep('intro')">${icon('back')}</button>
      <div class="mh-t">Add bank account details</div>
      <button class="mh-close" aria-label="Close" onclick="closeConnect()">✕</button>
    </div>
    <div class="modal-body">
      <div class="md muted small" style="margin-bottom:14px">Withdrawals can only be made to your personal bank account (registered against your ID number). No third-party accounts can be used.</div>
      <div class="field"><label>Bank Name</label>
        <select class="select" id="cf-bank" aria-label="Bank name" onchange="checkConnectForm()"><option value="">Select bank</option>${BANKS.map(b=>`<option>${b}</option>`).join('')}${BANKS_DISABLED.map(b=>`<option disabled>${b}</option>`).join('')}</select>
        ${tc?`<div class="hint" style="margin-top:6px">More ${market().label} providers are being added.</div>`:''}</div>
      <div class="field"><label>Account Number</label>
        <input class="input" id="cf-acct" inputmode="numeric" maxlength="12" placeholder="Enter your account number" oninput="this.value=this.value.replace(/[^0-9]/g,'');checkConnectForm()">
        <div id="cf-err" class="hint" style="display:none;color:var(--red);margin-top:6px">Account number must be at least 6 digits.</div></div>
      <div class="field"><label>Account Type</label>
        <select class="select" id="cf-type" aria-label="Account type" onchange="checkConnectForm()"><option value="">Select account type</option>${ACCT_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div>
      <div class="actions"><button class="btn btn-primary" id="cf-next" disabled onclick="connectSubmit()">Next</button></div>
      <div class="trust" style="margin-top:12px">${icon('lock')}<div>Read-only &amp; encrypted. Your details go to your provider, never stored by Absa.</div></div>
    </div>`;
}
function checkConnectForm(){
  const name=(document.getElementById('cf-bank')||{}).value;
  const no=((document.getElementById('cf-acct')||{}).value||'').trim();
  const type=(document.getElementById('cf-type')||{}).value;
  const err=document.getElementById('cf-err'); if(err) err.style.display=(no.length>0&&no.length<6)?'block':'none';
  const b=document.getElementById('cf-next'); if(b) b.disabled=!(!!name && no.length>=6 && !!type);
}
function connectSubmit(){
  CONNECT.chosenBank=document.getElementById('cf-bank').value;
  CONNECT.acctMask=(document.getElementById('cf-acct').value||'').slice(-4);
  CONNECT.acctType=document.getElementById('cf-type').value;
  connectStep('verify'); simulateLink(CONNECT.chosenBank);
}
function connectVerify(){
  return `<div class="modal-body center" style="padding:38px 24px 40px">
    <div class="spin" style="width:38px;height:38px;border-width:4px;margin:0 auto 18px"></div>
    <h3 style="font-size:17px;font-weight:800">Verifying your ${CONNECT.chosenBank} account</h3>
    <div class="md muted small" style="margin-top:8px">Confirming the account details and building your picture. This takes a few seconds.</div></div>`;
}
function connectDone(){
  const f=CONNECT;
  return `<div class="modal-body center" style="padding:30px 22px">
    <div class="connect-tick">${icon('check')}</div>
    <h3 style="font-size:19px;font-weight:800">${f.chosenBank} account added</h3>
    <div class="md muted small" style="margin-top:8px">${f.acctType||'Bank'} account ····${f.acctMask||'0000'} is verified. We've categorised your transactions and built your picture automatically.</div>
    <div class="actions" style="margin-top:20px">
      <button class="btn btn-primary" onclick="finishLink(CONNECT.outcome)">Continue</button>
      <button class="btn btn-ghost" onclick="connectStep('form')">＋ Add another account</button>
    </div></div>`;
}
/* Simulated verify outcome, App D failure states + retry-once posture */
let FORCE_FAIL = null; // dev override: a failure-state key
function simulateLink(bank){
  setTimeout(()=>{
    if(!CONNECT) return;
    const outcome = FORCE_FAIL || 'success';
    if(outcome==='success' || outcome==='partial_sync'){ CONNECT.outcome=outcome; connectStep('done'); }
    else if(outcome==='already_linked'){ finishLink(outcome); }
    else { CONNECT.failure=outcome; connectStep('failure'); }
  }, 1300);
}
const FAILURES = {
  wrong_credentials:{t:'Wrong credentials', d:'Those details didn\'t match. Try again, or use the no-link path.', retry:true},
  bank_down:{t:'Bank temporarily unavailable', d:'Your bank\'s connection is down right now. Try later, or continue without linking.', retry:false},
  mfa_loop:{t:'Verification didn\'t complete', d:'The one-time verification looped. We can retry, or you can continue without linking.', retry:true},
  no_accounts:{t:'No accounts found', d:'We couldn\'t find accounts there. Try a different bank, add manually, or continue without linking.', retry:false},
  timeout:{t:'Connection timed out', d:'That took too long. We can retry once, or continue without linking.', retry:true},
  not_supported:{t:'Bank not supported yet', d:'We can\'t link this provider yet. Forward a statement or continue without linking.', retry:false},
  already_linked:{t:'Already linked', d:'This account is already connected, taking you straight in.', retry:false},
  partial_sync:{t:'Some accounts synced', d:'We landed what arrived and will keep fetching the rest in the background.', retry:false},
  generic:{t:'Something went wrong', d:'A general error occurred. We can retry once, then fall back, we\'ll keep trying in the background.', retry:true},
};
function connectFailure(){
  const f=FAILURES[CONNECT.failure]||FAILURES.generic;
  const canRetry = f.retry && CONNECT.retry<1;
  track('link_attempt_failed',{reason:CONNECT.failure});
  return `<div class="modal-head">
      <div class="mi" style="width:44px;height:44px;border-radius:12px;background:var(--red-soft);color:var(--red);display:flex;align-items:center;justify-content:center">${icon('info')}</div>
      <div><div class="mh-t">${f.t}</div><div class="md muted small">${f.d}</div></div>
      <button class="mh-close" aria-label="Close" onclick="closeConnect()">✕</button>
    </div>
    <div class="modal-body">
      <div class="actions">
        ${canRetry? `<button class="btn btn-primary" onclick="retryLink()">${icon('refresh')} Retry once</button>`:''}
        ${CONNECT.failure==='not_supported'? `<button class="btn btn-ghost" onclick="connectStep('statement')">Forward a statement instead</button>`:''}
        ${CONNECT.failure==='no_accounts'? `<button class="btn btn-ghost" onclick="connectStep('form')">Try different details</button>`:''}
        <button class="btn ${canRetry?'btn-ghost':'btn-primary'}" onclick="connectFallbackNow()">Continue without linking</button>
      </div>
    </div>`;
}
function retryLink(){ CONNECT.retry++; FORCE_FAIL=null; connectStep('verify'); simulateLink(CONNECT.chosenBank); }
function connectStep(s){ CONNECT.step=s; renderConnect(); }

function connectIncome(){
  return `<div class="modal-head">
      <button class="mh-close" aria-label="Back" style="margin-left:0;margin-right:6px" onclick="connectStep('intro')">${icon('back')}</button>
      <div class="mh-t">Add your income</div>
      <button class="mh-close" aria-label="Close" onclick="closeConnect()">✕</button>
    </div>
    <div class="modal-body">
      <div class="field"><label>Monthly income (after tax)</label>
        <input class="input" id="ci-income" aria-label="Monthly income after tax" type="number" placeholder="${market().cur}0" value="${state.income||''}"></div>
      <label class="opt" style="cursor:pointer"><input type="checkbox" id="ci-varies" ${state.incomeVaries?'checked':''} style="width:18px;height:18px;accent-color:var(--v-green)">
        <span class="opt-body"><span class="opt-t" style="font-size:14px">My income varies</span><span class="opt-d">Self-employed / commission, we'll use a typical month and a lighter-touch read</span></span></label>
      <div class="actions" style="margin-top:14px"><button class="btn btn-primary" onclick="saveIncomeFloor()">Continue with income only</button></div>
      <div class="hint center" style="margin-top:8px">Honest and lighter than a link, an income-anchored view, never a fake full picture.</div>
    </div>`;
}
function saveIncomeFloor(){
  const v=parseFloat((document.getElementById('ci-income')||{}).value);
  if(isNaN(v) || v<=0){ shake('ci-income'); return; } // a positive income is the whole point; never a fake zero
  state.income = v;
  state.incomeVaries = document.getElementById('ci-varies').checked;
  state.linkMethod='income'; state.fed.yourMoney = 'income';
  track('money_connected',{method:'income'});
  save(); finishConnect('income');
}
function connectStatement(){
  return `<div class="modal-head">
      <button class="mh-close" aria-label="Back" style="margin-left:0;margin-right:6px" onclick="connectStep('intro')">${icon('back')}</button>
      <div class="mh-t">Forward a statement</div>
      <button class="mh-close" aria-label="Close" onclick="closeConnect()">✕</button>
    </div>
    <div class="modal-body">
      <div class="stub" style="border-style:dashed;justify-content:center;padding:28px;text-align:center;display:block">
        ${icon('doc')}<div class="st" style="margin-top:8px">Drop a PDF statement here</div>
        <div class="sd">or email it to statements@vault22.com</div>
      </div>
      <div class="actions" style="margin-top:14px"><button class="btn btn-primary" onclick="finishStatement()">I've forwarded my statement</button></div>
    </div>`;
}
function finishStatement(){ applyLinkedFeed('statement'); track('money_connected',{method:'statement'}); finishConnect('statement'); }

function finishLink(outcome){
  applyLinkedFeed('bank', outcome);
  track('money_connected',{method:'bank'});
  finishConnect('bank', outcome);
}
/* Link-removes-manual rule: linking pre-fills & marks every zone the feed can supply. */
function applyLinkedFeed(method, outcome){
  state.linked = true; state.linkMethod = method;
  state.linkedAccounts = [{name:CONNECT&&CONNECT.chosenBank||'Bank', bal: 42350},{name:'Savings', bal:88200}];
  // feed supplies: net worth, spending, debt balances, savings, investments if present
  state.income = state.income || 32000;
  Object.assign(state.fed, {yourMoney:'feed', whereItGoes:'feed', whatYouOwe:'feed', partial: outcome==='partial_sync'});
  save();
}
function connectFallbackNow(){ track('step_skipped',{step:'connect'}); finishConnect('none'); }
function finishConnect(method, outcome){
  const cb = CONNECT && CONNECT.onDone;               // capture BEFORE clearing
  document.getElementById('modal-root').innerHTML=''; // close the modal
  CONNECT=null;
  if(cb) cb(method, outcome); else landDashboard();
}

/* ============================================================================
   SECTION 3, The one adaptive dashboard
   (built here; journeys in Section 4 feed into it)
   ============================================================================ */
function landDashboard(){ state.onboardingComplete=true; save(); track('onboarding_completed',{path:primaryPick()}); go('dashboard'); if(!state.metTara) showMeetTara(); }

/* Meet Tara, first-use hand-off (Appendix B #7). An overlay (spec: screen-or-overlay
   [to confirm]) that introduces Tara, reads the aha back, and hands off to the #1
   journey's first action. Its Continue fires first_action_started (Appendix E). */
function showMeetTara(){
  state.metTara=true; save();
  closeOtherOverlays();
  const gentle=['Not very confident','Stressed'].includes(state.confidence);
  const sc=computeScore();
  let line;
  if(sc.score==null){
    line = sc.level==='income'
      ? `You've added your income. Link a bank when you're ready and I'll turn it into your real Financial Fitness Score and a plan.`
      : `Link an account or add your income and I'll build your net worth, cashflow and Financial Fitness Score.`;
  } else {
    // Introduce + hand off here; the dashboard banner does the specific score read-back,
    // so the overlay must NOT repeat the number/opportunity (avoids saying it twice).
    line = `I've turned everything you shared into a live picture of your money, and I'll keep reading it back and nudging you as things change. Your <b>Financial Fitness Score</b> and next best step are ready right here.`;
  }
  const first = intent(primaryPick());
  const mr=document.getElementById('modal-root'); if(!mr) return;
  mr.innerHTML = `<div class="modal-back"><div class="modal meet-tara">
    <div class="mt-ava">${icon('spark')}<span class="mt-dot"></span></div>
    <div class="mt-eyebrow">Meet Tara · your AI money coach</div>
    <h3 class="mt-title">Hi ${state.name||'there'}, I'm Tara</h3>
    <div class="mt-msg">${line}</div>
    <div class="mt-msg" style="margin-top:10px">I've set your dashboard to lead with <b>${first.label.toLowerCase()}</b>, ${gentle?"and we'll take it one calm step at a time.":"here's your first step."}</div>
    <div class="actions" style="margin-top:22px"><button class="btn btn-primary" onclick="taraHandoff()">Show me my plan ${icon('arrow')}</button></div>
  </div></div>`;
}
function taraHandoff(){
  track('first_action_started',{path:primaryPick()});
  const mr=document.getElementById('modal-root'); if(mr) mr.innerHTML='';
  // Hand-off complete: the dashboard now leads with the #1 zone and its primary next move.
  window.scrollTo(0,0);
}

// which zones are "fed" enough to render real/partial data
function zoneFed(z){ return state.fed[z]; }
// zones picked (from fork) beyond primary
function pickedZones(){ return state.picks.map(k=>intent(k).zone); }

const ZONES = {
  yourMoney:{ t:'Your money', sub:'Net worth', icon:'coins', universal:true },
  whereItGoes:{ t:'Where it goes', sub:'Spending vs budget', icon:'wallet' },
  whatYouOwe:{ t:'What you owe', sub:'Debt', icon:'chain' },
  yourWealth:{ t:'Your wealth', sub:'Investing', icon:'trend' },
  aimingFor:{ t:'What you are aiming for', sub:'Goals', icon:'target' },
  fitness:{ t:'Financial fitness', sub:'Your score', icon:'heart', universal:true },
};

SCREENS.dashboard = () => {
  const p = primaryPick();
  const heroZone = intent(p).zone;
  const picks = state.picks.length? state.picks : ['understand'];
  // Render order (spec 3.2): greeting(topbar) -> hero(#1 zone) -> ranked -> universal -> stubs -> roll-up.
  // Vault22 treatment: the hero (#1 zone) carries the signature green-gradient card.
  const rendered = new Set([heroZone]);
  const cells = []; // white cards for ranked/universal/fed zones
  const cell = (z, opts) => { rendered.add(z); cells.push(`<div class="cell span-${spanFor(z,opts)}">${renderZone(z,opts)}</div>`); };

  picks.slice(1).forEach((k,idx)=>{ const z=intent(k).zone; if(!rendered.has(z)) cell(z, {rank:idx+2}); });   // #2,#3
  ['yourMoney','fitness'].forEach(z=>{ if(!rendered.has(z)) cell(z, {}); });                                   // universal
  Object.keys(ZONES).forEach(z=>{ if(!rendered.has(z) && zoneFed(z)) cell(z, {}); });                          // fed-but-unpicked

  const stubs = Object.keys(ZONES).filter(z=>!rendered.has(z)); stubs.forEach(z=>rendered.add(z));
  // When there are only 1-2 stubs AND a setup card, pair them two-up so the row fills
  // instead of leaving the Discover band mostly empty.
  const hasSetup = completeSetup(12) !== '';
  const twoUp = stubs.length > 0 && stubs.length <= 2 && hasSetup;
  const discover = stubs.length? `<div class="cell discover ${twoUp?'span-6':''}"><div class="discover-head">Discover more</div>
      <div class="discover-grid"${twoUp?' style="grid-template-columns:1fr"':''}>${stubs.map(z=>renderStub(z)).join('')}</div></div>` : '';

  const grid =
    taraBanner() +
    heroCard(heroZone) +
    cells.join('') +
    discover +
    completeSetup(twoUp?6:12);

  return appShell(`<div class="dash-grid">${grid}</div>`);
};

/* ---- signature green hero, adapts to the #1 zone ---- */
function heroCard(z){
  const fed = zoneFed(z);
  const eyebrowMap = {yourMoney:'Net worth', whereItGoes:'Budget for this month', whatYouOwe:'What you owe',
    yourWealth:'Your wealth', aimingFor:"What you're aiming for", fitness:'Financial fitness'};
  const top = `<div class="hero-top">
      <div><div class="hero-eyebrow">${eyebrowMap[z]||''}</div></div>
      <span class="hero-lead-badge">#1 priority</span>
      ${(z==='yourMoney')?`<button class="hero-eye" title="Hide amounts" aria-label="Hide amounts" aria-pressed="false" onclick="toggleHideAmounts(this)">${icon('eye')}</button>`:''}
    </div>`;
  let inner;
  switch(z){
    case 'yourMoney':   inner = heroYourMoney(fed); break;
    case 'whereItGoes': inner = heroBudget(fed); break;
    case 'whatYouOwe':  inner = heroDebt(fed); break;
    case 'yourWealth':  inner = heroWealth(fed); break;
    case 'aimingFor':   inner = heroGoal(fed); break;
    case 'fitness':     inner = heroFitness(fed); break;
    default: inner='';
  }
  return `<div class="hero">${top}${inner}</div>`;
}
function heroNum(n){ return `<div class="hero-num"><span class="cur">${curPrefix()}</span><span class="js-count" data-count="${Math.round(n)}">0</span></div>`; }
function upPill(txt){ return `<span class="hero-pill">${icon('trend')} ${txt}</span>`; }

function heroYourMoney(fed){
  if(fed==='feed'){
    const nw = state.linkedAccounts.reduce((a,b)=>a+b.bal,0)-16400;
    const inc = state.income||32000;
    return `${heroNum(nw)}<div class="hero-sub">Across ${state.linkedAccounts.length} linked accounts</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hs-label">Savings</div><div class="hs-val">${cur(88200)}</div>${upPill('+'+cur(5360)+' (30d)')}</div>
        <div class="hero-stat"><div class="hs-label">Everyday</div><div class="hs-val">${cur(42350)}</div>${upPill('on track')}</div>
      </div>
      <div class="hero-bar-wrap">
        <div class="hero-bar-top"><span class="hb-l">Budget this month <b>${cur(inc)} / ${cur(4820)} left</b></span><span class="hb-r">You're on track</span></div>
        <div class="hero-bar"><i data-w="80" style="width:80%"></i></div>
      </div>
      ${heroAdjustBtn('understand','Manage connection')}`;
  }
  if(fed==='income'){
    return `${heroNum((state.income||0)*4.5)}<div class="hero-sub">Income-anchored estimate${state.incomeVaries?' · income varies, lighter read':''}. Link a bank for your real worth.</div>
      <button class="hero-cta" onclick="pushLink()">${icon('bank')} Link an account</button>
      ${heroAdjustBtn('understand','Adjust my details')}`;
  }
  return `<div class="hero-num" style="font-size:34px">${curPrefix()} —</div>
    <div class="hero-sub">Link an account or add your income to see your worth, never a bare zero.</div>
    <button class="hero-cta" onclick="pushLink()">${icon('coins')} Add income or link</button>`;
}
function heroBudget(fed){
  const a=state.answers.spending||{}; const inc=state.income||32000;
  if(fed==='feed'){
    return `<div class="hero-num">${curPrefix()}<span class="js-count" data-count="4820">0</span> <span style="font-size:22px;font-weight:700;opacity:.85">left</span></div>
      <div class="hero-sub">${cur(inc)} in · ${a.q1||'50/30/20'} · pay-day sets the period</div>
      <div class="hero-bar-wrap">
        <div class="hero-bar-top"><span class="hb-l">Spent <b>${cur(inc-4820)}</b> of ${cur(inc)}</span><span class="hb-r">You're on track</span></div>
        <div class="hero-bar"><i data-w="85" style="width:85%"></i></div>
      </div>
      <button class="hero-cta" onclick="moduleToast('The Budget module')">${icon('wallet')} Set your real budget</button>
      ${heroAdjustBtn('spending','Adjust budget')}`;
  }
  if(fed==='income' || state.answers.spending){
    return `<div class="hero-num">${curPrefix()}<span class="js-count" data-count="${Math.round(inc*0.15)}">0</span> <span style="font-size:22px;font-weight:700;opacity:.85">left</span></div>
      <div class="hero-sub">Starter budget from your numbers (${a.q1||'50/30/20'}). Thin by design, link for the real feed.</div>
      <div class="hero-bar-wrap"><div class="hero-bar"><i data-w="72" style="width:72%"></i></div></div>
      <button class="hero-cta" onclick="pushLink()">${icon('bank')} Link for the real budget</button>
      ${heroAdjustBtn('spending','Adjust budget')}`;
  }
  return `<div class="hero-num" style="font-size:34px">Set your budget</div>
    <div class="hero-sub">Fills in when you link, or set a quick starter budget.</div>
    <button class="hero-cta" onclick="startJourneyFromDash('spending')">${icon('wallet')} Start</button>`;
}
function heroDebt(fed){
  const a=state.answers.debt||{};
  if(fed==='feed' || a.manual){
    return `${heroNum(a.manual? a.total : 16400)}<div class="hero-sub">${a.types?a.types.join(', ')+' · ':''}Your payoff plan lives in the Debt module</div>
      ${heroBuckets(a.bucket||'stretched')}
      <button class="hero-cta" onclick="moduleToast('The Debt module')">${icon('chain')} Open Debt module</button>
      ${heroAdjustBtn('debt','Adjust debts')}`;
  }
  if(a.q3||a.bucket||a.band){
    return `<div class="hero-num" style="font-size:34px">Your debt, at a glance</div>
      <div class="hero-sub">A calm, directional read from your band and income, no exact figure needed.</div>
      ${heroBuckets(a.bucket||'stretched')}
      <button class="hero-cta" onclick="startJourneyFromDash('debt')">${icon('chain')} Add debts for a real plan</button>
      ${heroAdjustBtn('debt','Adjust debts')}`;
  }
  return `<div class="hero-num" style="font-size:34px">Get out of debt</div><div class="hero-sub">Add your debts, or link, to see this.</div>
    <button class="hero-cta" onclick="startJourneyFromDash('debt')">${icon('chain')} Add your debt</button>`;
}
function heroBuckets(on){
  const items=[['manageable','Manageable'],['stretched','Stretched'],['heavy','Heavy']];
  return `<div class="hero-chips" style="margin-top:18px">
    ${items.map(([k,l])=>`<div class="hero-chip ${on===k?'':'locked'}"><div class="hc-l">${on===k?'Where you are':''}</div><div class="hc-v">${l}</div></div>`).join('')}
  </div><div class="hero-sub" style="margin-top:10px">Directional only, no verdict labels. DTI is computed by the Debt module from self-declared income.</div>`;
}
function heroWealth(fed){
  const w=state.plan||state.answers.wealth||{};
  if(w.portfolio||w.name){
    const band=w.risk||3;
    return `<div class="hero-num" style="font-size:36px">${w.name||w.portfolioName||'Balanced Growth'}</div>
      <div class="hero-sub">Suggested portfolio · risk ${band}/5 · ${w.shariah?'Shariah':'Conventional'}</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hs-label">Recommended term</div><div class="hs-val">${band<=2?'1–3 yrs':band===3?'3–5 yrs':'5+ yrs'}</div></div>
        <div class="hero-stat"><div class="hs-label">Past 5y (illustrative)</div><div class="hs-val">+${(5+band*1.5).toFixed(1)}%</div>${upPill('p.a.')}</div>
      </div>
      <button class="hero-cta" onclick="moduleToast('Account opening')">${icon('trend')} Open your account</button>
      ${heroAdjustBtn('wealth','Adjust plan')}`;
  }
  return `<div class="hero-num" style="font-size:34px">Grow your wealth</div><div class="hero-sub">Start investing, or browse model portfolios.</div>
    <button class="hero-cta" onclick="startJourneyFromDash('wealth')">${icon('trend')} Start investing</button>`;
}
function heroGoal(fed){
  const g=state.goal;
  if(g){
    const types = (g.types&&g.types.length)? g.types : [g.type];
    const more = types.length>1;
    const chips = more ? `<div class="hero-chips" style="margin-top:18px">${types.map((t,i)=>`<div class="hero-chip"><div class="hc-l">Goal ${i+1}</div><div class="hc-v">${t}</div></div>`).join('')}</div>` : '';
    const tgt = g.target ? `${g.projected?'Projected target':(more?'Combined target':'Target')} ${cur(g.target)}${g.year?` by ${g.year}`:''}` : 'Add a target to track your progress';
    const pct = g.started?34:6;
    return `<div class="hero-num" style="font-size:36px">${g.type}</div>
      <div class="hero-sub">${more?`${types.length} goals · `:''}${tgt}</div>
      <div class="hero-bar-wrap"><div class="hero-bar-top"><span class="hb-l">Progress</span><span class="hb-r">${g.probability||'Getting started'}</span></div>
        <div class="hero-bar"><i data-w="${pct}" style="width:${pct}%"></i></div></div>
      ${chips}
      <div class="hero-stats"><div class="hero-stat"><div class="hs-label">Monthly contribution</div><div class="hs-val">${cur(g.monthly||1800)}</div></div></div>
      <button class="hero-cta" onclick="adjustGoal()">${icon('target')} Adjust plan</button>`;
  }
  return `<div class="hero-num" style="font-size:34px">Save for a goal</div><div class="hero-sub">Set a goal to see progress here.</div>
    <button class="hero-cta" onclick="startJourneyFromDash('save')">${icon('target')} Set a goal</button>`;
}
function heroFitness(fed){
  const sc=computeScore();
  if(!sc.score){
    return `<div class="hero-score"><div class="hero-dial"><svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="58" stroke="rgba(255,255,255,.28)" stroke-width="11" fill="none"/></svg>
        <div class="hd-mid"><div class="hd-pending">Getting your score ready</div></div></div>
      <div><div class="hero-sub">${sc.level==='income'?'Income only, no half-real number shown.':'No number until there’s enough data.'}</div>
        <button class="hero-cta" onclick="pushLink()">${icon('bank')} ${sc.level==='income'?'Link a bank for your real score':'Add income or link'}</button>
        ${state.answers.health?heroAdjustBtn('health','Adjust answers'):''}</div></div>`;
  }
  const c=2*Math.PI*58, pct=Math.round(sc.score/1000*100);
  const dial=`<div class="hero-dial"><svg viewBox="0 0 132 132">
    <circle cx="66" cy="66" r="58" stroke="rgba(255,255,255,.28)" stroke-width="11" fill="none"/>
    <circle class="val" cx="66" cy="66" r="58" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round" stroke-dasharray="${c}" data-len="${c}" data-off="${c-(c*pct/100)}" style="stroke-dashoffset:${c}"/>
    </svg><div class="hd-mid"><div class="hd-num js-count" data-count="${sc.score}">0</div><div class="hd-lvl">${sc.levelLabel}</div></div></div>`;
  const chips=Object.entries(sc.subs).map(([k,v])=>`<div class="hero-chip ${v==null?'locked':''}"><div class="hc-l">${k}</div><div class="hc-v">${v==null?'—':v+'/200'}</div></div>`).join('');
  return `<div class="hero-score">${dial}
    <div style="flex:1;min-width:230px">
      <div class="hero-sub" style="margin-bottom:12px">${sc.level==='partial'?'A firm score, still building. Add investments & insurance to unlock the rest.':'Your full score and five sub-scores.'}</div>
      <div class="hero-chips">${chips}</div>
    </div></div>
    <button class="hero-cta" style="margin-top:20px" onclick="moduleToast('The Financial Fitness module')">${icon('heart')} ${sc.level==='full'?'View your plan':'Improve your score'}</button>
    ${state.answers.health?heroAdjustBtn('health','Adjust answers'):''}`;
}

/* ---- quick actions (green tiles, live app) ---- */
function quickActions(){
  const acts=[
    ['trend','Invest',"startJourneyFromDash('wealth')"],
    ['wallet','Budget',"startJourneyFromDash('spending')"],
    ['chart','Transactions',"moduleToast('Transactions')"],
    ['chat','Ask Tara',"moduleToast('Tara, your AI money coach')"]
  ];
  return `<div class="qa-row">${acts.map(([ic,l,act])=>`<button class="qa-tile ${l==='Ask Tara'?'dark':''}" onclick="${act}">${icon(ic)}<span class="qa-l">${l}</span></button>`).join('')}</div>`;
}

/* ---- Tara: full-width gradient banner (matches live web dashboard) ---- */
function taraBanner(){
  const gentle=['Not very confident','Stressed'].includes(state.confidence);
  const sc=computeScore(); let head, sub, cta;
  if(sc.score==null){
    if(sc.level==='income'){
      head = `You've added your income, link a bank for your real score`;
      sub = gentle?`No pressure. When you're ready, I'll turn it into your Financial Fitness Score and a plan.`:`I'll turn it into your Financial Fitness Score and a personalised plan.`;
      cta = 'Link a bank';
    } else {
      head = `Link an account and I'll build your money picture`;
      sub = gentle?`We'll take this one calm step at a time.`:`Net worth, cashflow and your Financial Fitness Score, read back to you.`;
      cta = 'Get started';
    }
  } else {
    head = `Your Financial Fitness Score is ${sc.score}, biggest opportunity: ${sc.opportunity}`;
    sub = gentle?`We'll go gently. Here are your next best steps.`:`Here are your next best steps, prioritised for you.`;
    cta = 'See your plan';
  }
  // Already scored (linked or self-reported)? 'See your plan' opens the plan, not the link modal.
  const action = sc.score!=null ? "moduleToast('Your plan, in the Financial Fitness module')" : "pushLink()";
  return `<div class="tara-banner">
    <div class="tb-ava">${icon('spark')}<span class="tb-dot"></span></div>
    <div class="tb-copy"><div class="tb-eyebrow">Tara · your AI money coach</div>
      <div class="tb-head">${head}</div><div class="tb-sub">${sub}</div></div>
    <button class="tb-cta" onclick="${action}">${cta} ${icon('arrow')}</button>
  </div>`;
}

/* ---- Complete your setup, matches the live "Profile" completion card (progress + remaining rows) ---- */
function completeSetup(span){
  span = span || 12;
  const items=[
    {icon:'wallet', label:'Set your budget',              intent:'spending',   done: !!state.answers.spending || state.fed.whereItGoes},
    {icon:'bank',   label:'Add income / link a bank',     intent:'understand', done: !!state.fed.yourMoney},
    {icon:'chain',  label:'Add your debt',                intent:'debt',       done: !!state.answers.debt || state.fed.whatYouOwe},
    {icon:'trend',  label:'Start investing',              intent:'wealth',     done: !!state.plan || !!(state.answers.wealth&&state.answers.wealth.portfolio)},
    {icon:'target', label:'Set a goal',                   intent:'save',       done: !!state.goal},
    {icon:'heart',  label:'Complete your fitness profile',intent:'health',     done: computeScore().level==='full'},
  ];
  const done=items.filter(i=>i.done).length;
  if(done===items.length) return '';
  const pct=Math.round(done/items.length*100);
  const todo=items.filter(i=>!i.done);
  return `<div class="cell span-${span}"><div class="zone">
    <div class="zone-head"><span class="zt">Complete your setup<span class="zsub">${done} of ${items.length} done</span></span>
      <span class="lead-badge">${pct}% complete</span></div>
    <div class="ff-bar" style="margin-bottom:18px"><i data-w="${pct}" style="width:${pct}%"></i></div>
    <div class="setup-rows">
      ${todo.map(it=>`<button class="setup-row" onclick="startJourneyFromDash('${it.intent}')">
        <span class="sr-ic">${icon(it.icon)}</span><span class="sr-l">${it.label}</span><span class="sr-go">${icon('chevRight')}</span>
      </button>`).join('')}
    </div>
  </div></div>`;
}
function spanFor(z, opts){
  if(opts && opts.hero) return 12;  // hero is full-width (green card)
  return 6;                          // everything else pairs two-up, like the live web app
}
function spanForOld(z, opts){
  if(opts && opts.hero) return 12;
  if(z==='fitness') return 12;      // rich rings, full width
  if(z==='whereItGoes') return 12;  // budget breakdown reads best wide
  if(z==='yourMoney' && !(opts&&opts.rank)) return 12; // universal net-worth banner (with sparkline)
  return 6;
}
/* animate the dashboard on mount: count-up numbers, draw rings/dial, budget bars */
SCREEN_AFTER.dashboard = () => {
  if(HIDE_AMOUNTS){ const d=document.querySelector('.dash'); if(d) d.classList.add('amounts-hidden'); const eye=document.querySelector('.hero-eye'); if(eye){eye.setAttribute('aria-pressed','true');eye.title='Show amounts';} }
  requestAnimationFrame(()=>animateDashboard());
};
function animateDashboard(){
  // rings / dial / donut segments: from empty to target
  document.querySelectorAll('circle.val[data-off], circle.seg[data-off]').forEach(c=>{
    const target=parseFloat(c.getAttribute('data-off'));
    const len=parseFloat(c.getAttribute('data-len'));
    c.style.strokeDashoffset=len; // start empty
    requestAnimationFrame(()=>{ c.style.strokeDashoffset=target; });
  });
  // bars (white cards + green hero)
  document.querySelectorAll('.budget-bar-track > i[data-w], .hero-bar > i[data-w]').forEach(b=>{ b.style.width='0%'; requestAnimationFrame(()=>b.style.width=b.getAttribute('data-w')+'%'); });
  // count-up numbers (skip the currency-prefix span in hero-num which formats itself)
  document.querySelectorAll('.js-count[data-count]').forEach(el=>countUp(el));
}
function countUp(el){
  const to=parseFloat(el.getAttribute('data-count')); if(isNaN(to))return;
  const pre=el.getAttribute('data-pre')||''; const dur=850; const start=performance.now();
  const neg=to<0; const abs=Math.abs(to);
  function tick(now){
    const t=Math.min(1,(now-start)/dur); const e=1-Math.pow(1-t,3);
    const v=Math.round(abs*e);
    el.textContent=(neg?'-':'')+pre+v.toLocaleString('en-ZA');
    if(t<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function appShell(content){
  const nm = (state.name||'there').split(' ')[0];
  // Live web app nav (matches global-website.dev.vault22.com). Home routes to the dashboard; the rest are post-onboarding modules.
  const navItems = [
    ['home','Home',null,"go('dashboard')",true],
    ['doc','Transactions',null,"moduleToast('Transactions')"],
    ['wallet','Budget',null,"moduleToast('The Budget module')"],
    ['trend','Investments',null,"moduleToast('The Investments module')"],
    ['coins','My Wealth','Accounts',"moduleToast('My Wealth')"],
    ['heart','Financial Fitness',null,"moduleToast('The Financial Fitness module')"],
    ['target','Goals',null,"moduleToast('The Goals module')"],
    ['family','Family Circle',null,"moduleToast('Family Circle')"],
    ['chain','Debt',null,"moduleToast('The Debt module')"],
    ['shield','Insurance',null,"moduleToast('Insurance')"],
    ['crypto','Crypto Portfolio',null,"moduleToast('Crypto Portfolio')"],
    ['grid','Marketplace',null,"moduleToast('Marketplace')"],
    ['spark','Insights',null,"moduleToast('Insights')"]
  ];
  const m=market();
  return `<div class="app">
    <div class="nav-scrim" onclick="closeMobileNav()"></div>
    <aside class="sidebar">
      <div class="side-head"><span class="side-title">Menu</span><button class="side-collapse" title="Collapse menu" aria-label="Collapse menu" onclick="toggleSidebar()">${icon('chevLeft')}</button></div>
      <nav class="nav">
        ${navItems.map(([ic,l,sub,act,on])=>`<button class="nav-item ${on?'active':''}" onclick="${act};closeMobileNav()">${icon(ic)} <span class="ni-l">${l}</span>${sub?`<span class="ni-sub">${sub}</span>`:''}</button>`).join('')}
      </nav>
    </aside>
    <div class="main">
      <div class="topbar">
        <button class="tb-burger" onclick="toggleSidebar()" aria-label="Open menu">${icon('grid')}</button>
        <div class="tb-logo"><svg class="mark" viewBox="0 0 64 64"><use href="#v22mark"/></svg><span class="w">Absa</span></div>
        <div class="spacer"></div>
        <button class="tb-bell" onclick="moduleToast('Notifications')">${icon('bell')}<span class="tb-badge">8</span></button>
        <button class="tb-pill" onclick="editRegion()">${(function(){const s=(m.cur.trim()||'');return (s && s!==m.curName)?`<b>${s}</b> ${m.curName}`:`<b>${m.curName}</b>`;})()}${icon('chevDown')}</button>
        <button class="tb-pill" onclick="editRegion()"><span class="tb-flag">${flagFor(state.region||'SA')}</span> ${m.label}${icon('chevDown')}</button>
        <button class="tb-user" onclick="moduleToast('Your account & settings')"><span class="tb-ava">${(nm[0]||'A').toUpperCase()}</span> ${nm.toLowerCase()}${icon('chevDown')}</button>
      </div>
      <div class="dash">
        <div class="dash-head"><h1 class="dash-h1">Hi ${nm} 👋</h1><div class="dash-hsub">Here's your money, read back by Tara</div></div>
        ${content}
      </div>
    </div>
  </div>${devbar()}`;
}

/* Tara reads it back: score + biggest opportunity + next steps (Section 0.8) */
function taraNarration(){
  const gentle = ['Not very confident','Stressed'].includes(state.confidence);
  const sc = computeScore();
  let msg;
  if(sc.score==null){
    if(sc.level==='income'){
      msg = gentle ? `You've added your income, that's a good first step. Link a bank when you're ready and I'll turn it into your real score, no pressure.`
                   : `You've added your income. Link a bank and I'll turn it into your real Financial Fitness Score and a plan.`;
    } else {
      msg = gentle ? `Let's take this one calm step at a time. Add your income or link an account and I'll start building your picture, no pressure.`
                   : `Link an account or add your income and I'll turn it into your Financial Fitness Score and a plan.`;
    }
  } else {
    msg = `Your Financial Fitness Score is <b>${sc.score}</b> (${sc.levelLabel}). Your biggest opportunity right now is <b>${sc.opportunity}</b>. ${gentle?'We\'ll go gently, one step at a time.':'Here are your next best steps below.'}`;
  }
  return `<div class="tara-bubble"><div class="tara-av">${icon('spark')}</div>
    <div><div class="tara-name">Tara</div><div class="tara-t">${msg}</div></div></div>`;
}

/* Score across data levels (3.4) */
function computeScore(){
  const linked = state.linked;
  const incomeOnly = !linked && state.income!=null;
  const noData = !linked && state.income==null;
  const useUplift = true; // Dependent->Free set assumed on [to confirm]
  const levelsUplift = ['Dependent','Surviving','Stable','Building','Free'];
  const levelsNative = ['Rookie','Enthusiast','Competitor','Expert','Elite'];
  const levels = useUplift? levelsUplift : levelsNative;
  // Self-reported: a completed Health manual intake earns a first (honest, self-reported)
  // score, per J-Health "show a first score, then add more to sharpen it". This is more
  // than income-only, so it does NOT fall to the wordmark state.
  const selfReported = !linked && state.fed.fitness==='manual' && state.income!=null;
  // The /1000 score is the SUM of the five /200 sub-scores, so the number always
  // reconciles with the chips shown (locked sub-scores contribute 0 until unlocked).
  const lvl = s => levels[Math.min(levels.length-1, Math.floor(s/200))];
  if(selfReported){ const subs=subScores('partial'); const s=sumSubs(subs); return {level:'partial', score:s, levelLabel:lvl(s), opportunity:'link a bank to sharpen your score', subs, selfReported:true}; }
  if(noData) return {level:'pending', score:null, levelLabel:'', opportunity:'', subs:subScores('none')};
  if(incomeOnly) return {level:'income', score:null, levelLabel:'', opportunity:'link a bank for your real score', subs:subScores('income')};
  const partial = state.fed.partial || (linked && Object.values(state.fed).filter(v=>v==='feed').length<3);
  const subs=subScores(partial?'partial':'full'); const score=sumSubs(subs);
  return {level: partial?'partial':'full', score, levelLabel:lvl(score), opportunity:`+${market().cur}250/month in savings`, subs};
}
function sumSubs(s){ return Object.values(s).reduce((a,v)=>a+(v||0),0); }
function subScores(mode){
  // five sub-scores, each /200, in plan order: Savings, Investments, Insurance, Spending, Debt clearance
  const base = {Savings:82, Investments:76, Insurance:120, Spending:144, 'Debt clearance':166};
  if(mode==='full') return base;
  if(mode==='partial') return {Savings:82, Investments:null, Insurance:null, Spending:144, 'Debt clearance':166};
  return {Savings:null, Investments:null, Insurance:null, Spending:null, 'Debt clearance':null};
}

/* ---- zone renderers ---- */
function zoneHead(z, opts){
  const Z=ZONES[z];
  const badge = opts.hero? `<span class="lead-badge">Leading with</span>` : (opts.rank? `<span class="lead-badge">#${opts.rank} priority</span>`:'');
  return `<div class="zone-head"><span class="zi">${icon(Z.icon)}</span>
    <span class="zt">${Z.t}<span class="zsub">${Z.sub}</span></span>${badge}</div>`;
}
function renderZone(z, opts){
  const fed = zoneFed(z);
  const cls = 'zone '+(opts.hero?'zone-hero':'');
  let body;
  switch(z){
    case 'yourMoney': body=zbYourMoney(fed); break;
    case 'whereItGoes': body=zbWhereItGoes(fed); break;
    case 'whatYouOwe': body=zbWhatYouOwe(fed, opts); break;
    case 'yourWealth': body=zbYourWealth(fed, opts); break;
    case 'aimingFor': body=zbAimingFor(fed, opts); break;
    case 'fitness': body=zbFitness(fed, opts); break;
    default: body='';
  }
  return `<div class="${cls}">${zoneHead(z,opts)}${body}</div>`;
}
function loadingSkeleton(lines){ return Array.from({length:lines||3}).map(()=>`<div class="skel skel-line" style="width:${60+Math.random()*35}%"></div>`).join(''); }
function fetchingNote(){ return `<div class="fetching-note"><span class="spin"></span> Fetching your accounts…</div>`; }

function zbYourMoney(fed){
  if(fed==='feed'){
    const nw = state.linkedAccounts.reduce((a,b)=>a+b.bal,0)-16400;
    return `<div class="big-num js-count" data-count="${nw}" data-pre="${market().cur}">${cur(nw)}</div>
      <div class="subline">Net worth across ${state.linkedAccounts.length} linked accounts</div>
      ${sparkline([118,120,119,123,126,124,129,131], true)}
      <div class="rowline"><span>Cash & bank</span><span class="r-amt">${cur(130550)}</span></div>
      <div class="rowline"><span>Debt</span><span class="r-amt" style="color:var(--red)">-${cur(16400)}</span></div>`;
  }
  if(fed==='income'){
    const est=(state.income||0)*4.5;
    return `<div class="big-num js-count" data-count="${est}" data-pre="${market().cur}">${cur(est)}</div>
      <div class="subline">Income-anchored estimate${state.incomeVaries?' (income varies, lighter read)':''}. Link a bank for your real worth.</div>
      <div class="next-move">${icon('bank')} Link an account for the real picture <span class="nm-cta" onclick="pushLink()">Link ›</span></div>`;
  }
  return `<div class="big-num pending">${market().cur}— · —</div>
    <div class="subline">Link an account or add your income to see your worth, never a bare zero.</div>
    <div class="next-move">${icon('coins')} Add income or link to begin <span class="nm-cta" onclick="pushLink()">Add ›</span></div>`;
}
/* premium sparkline */
function sparkline(series, up){
  const w=520, h=46, min=Math.min(...series), max=Math.max(...series), rng=(max-min)||1;
  const pts=series.map((v,i)=>[ (i/(series.length-1))*w, h-4-((v-min)/rng)*(h-10) ]);
  const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area=`${line} L${w} ${h} L0 ${h} Z`;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--v-green)" stop-opacity=".22"/><stop offset="1" stop-color="var(--v-green)" stop-opacity="0"/></linearGradient></defs>
    <path class="area" d="${area}"/><path class="line" d="${line}"/></svg>`;
}
/* Budget card, matches the live "Budget for this month" (spent/left + progress + top-spent tiles + View budget) */
function zbWhereItGoes(fed){
  const a=state.answers.spending||{};
  const tiles=(inc)=>{const needs=inc*0.5,wants=inc*0.3,sav=inc*0.2;
    return `<div class="budget-tiles">
      ${[['Needs',needs,'cat-purple','wallet'],['Wants',wants,'cat-orange','spark'],['Savings',sav,'cat-blue','coins']].map(([l,v,c,ic])=>
        `<div class="btile"><span class="bt-ic ${c}">${icon(ic)}</span><span class="bt-v">${cur(Math.round(v))}</span><span class="bt-l">${l}</span></div>`).join('')}
    </div>`;};
  if(fed==='feed'){
    const inc=state.income||32000, spent=inc-4820, pct=Math.round(spent/inc*100);
    return `<div class="budget-head"><div><div class="bh-v js-count" data-count="${spent}" data-pre="${market().cur}">${cur(spent)}</div><div class="bh-l">spent</div></div>
        <div class="right"><div class="bh-v" style="color:var(--v-green-700)"><span class="js-count" data-count="4820" data-pre="${market().cur}">${cur(4820)}</span></div><div class="bh-l">left this period</div></div></div>
      <div class="ff-bar" style="margin:14px 0"><i data-w="${pct}" style="width:${pct}%"></i></div>
      <div class="sect-mini">Top spent · ${a.q1||'50/30/20'}</div>${tiles(inc)}
      <button class="ff-btn" onclick="moduleToast('The Budget module')">View budget</button>`;
  }
  if(fed==='income' || state.answers.spending){
    const inc=state.income||0, left=Math.round(inc*0.15);
    return `<div class="subline" style="margin-bottom:14px">Starter budget from your numbers (${a.q1||'50/30/20'}). Thin by design, link for the real feed.</div>
      <div class="budget-head"><div><div class="bh-v js-count" data-count="${inc}" data-pre="${market().cur}">${cur(inc)}</div><div class="bh-l">money in</div></div>
        <div class="right"><div class="bh-v" style="color:var(--v-green-700)">${inc?cur(left):'—'}</div><div class="bh-l">left this period</div></div></div>
      <div class="ff-bar" style="margin:14px 0"><i data-w="72" style="width:72%"></i></div>
      <div class="sect-mini">Your split</div>${tiles(inc||32000)}
      <button class="ff-btn" onclick="pushLink()">${inc?'Link for the real budget':'Add your income'}</button>`;
  }
  return `<div class="subline">Fills in when you link, or set a quick starter budget.</div>
    <button class="ff-btn" onclick="startJourneyFromDash('spending')" style="margin-top:14px">Build your budget</button>`;
}
/* multi-colour donut (live Budget module) */
function donut(segs, midTop, midVal){
  const r=58, C=2*Math.PI*r, total=segs.reduce((a,b)=>a+b.val,0)||1; let start=0;
  const arcs=segs.map(s=>{
    const frac=s.val/total, len=frac*C, off=-start*C; start+=frac;
    return `<circle class="seg" cx="75" cy="75" r="${r}" fill="none" stroke="${s.color}" stroke-width="15" stroke-linecap="butt"
      stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" data-len="${C.toFixed(2)}" data-off="${off.toFixed(2)}" style="stroke-dashoffset:${(off+C).toFixed(2)}"/>`;
  }).join('');
  return `<div class="donut"><svg viewBox="0 0 150 150">${arcs}</svg>
    <div class="d-mid"><div class="dm-t">${midTop||''}</div><div class="dm-v">${midVal||''}</div></div></div>`;
}
function budgetRow(label, target, actual){
  const pct = actual!=null? Math.min(100,Math.round(actual/target*100)) : 0;
  const over = actual!=null && actual>target;
  return `<div style="margin:13px 0">
    <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:7px"><span style="font-weight:600">${label}</span>
      <span class="muted">${actual!=null?cur(Math.round(actual))+' / ':''}${cur(Math.round(target))}</span></div>
    <div class="budget-bar-track"><i data-w="${pct}" style="width:${pct}%;background:${over?'linear-gradient(90deg,#f7b955,var(--amber))':'linear-gradient(90deg,var(--v-green),var(--v-accent))'}"></i></div>
  </div>`;
}
/* Debt card, matches the live "Debt Overview" (total in red + next-payment highlight + monthly + View debt plan) */
function zbWhatYouOwe(fed, opts){
  const a=state.answers.debt||{};
  if(fed==='feed' || (a.manual)){
    const total=a.manual? a.total: 16400;
    return `<div class="debt-sub"><span>${a.types? a.types.length+' active':'Active debt'}</span>${a.priority?`<span class="warn">${a.priority}</span>`:''}</div>
      <div class="debt-total js-count" data-count="${total}" data-pre="${market().cur}">${cur(total)}</div>
      <div class="debt-due"><div><div class="dd-l">Next payment due</div><div class="dd-v">15 Jun · ${a.types&&a.types[0]||'Credit card'}</div></div><div class="dd-amt">${cur(250)}</div></div>
      <div class="rowline"><span>Monthly payment</span><span class="r-amt">${cur(a.manual? Math.round(total*0.03):1450)}/mo</span></div>
      <button class="ff-btn" onclick="moduleToast('The Debt module')">View debt plan</button>`;
  }
  if(a.q3 || a.bucket){ // quick read (band + income), directional, no verdict labels
    return `<div class="subline">A calm, directional read from your band and income, not an exact figure.</div>
      ${debtBuckets(a.bucket||'stretched')}
      <button class="ff-btn" onclick="startJourneyFromDash('debt')" style="margin-top:12px">Add your debts for a real plan</button>`;
  }
  return `<div class="subline">Fills in when you link, or add your debts manually.</div>`;
}
function debtBuckets(on){
  return `<div class="bucket-row">
    <div class="bucket manageable ${on==='manageable'?'on':''}">Manageable</div>
    <div class="bucket stretched ${on==='stretched'?'on':''}">Stretched</div>
    <div class="bucket heavy ${on==='heavy'?'on':''}">Heavy</div>
  </div><div class="hint" style="margin-top:6px">Calm and directional, no verdict labels. DTI is computed by the Debt module from self-declared income.</div>`;
}
function zbYourWealth(fed, opts){
  const g=state.goal;
  const w=state.plan||(state.answers.wealth&&state.answers.wealth.portfolio?state.answers.wealth:null);
  if(w){
    return `<div class="subline">Suggested portfolio · risk band ${w.risk||3}/5 · ${w.shariah?'Shariah':'Conventional'}</div>
      <div class="big-num" style="font-size:26px">${w.name||w.portfolioName||'Balanced Growth'}</div>
      <div class="rowline"><span>Recommended term</span><span class="r-amt">5+ yrs</span></div>
      <div class="rowline"><span>Past 5y return (illustrative)</span><span class="r-amt" style="color:var(--v-green-700)">+9.2% p.a.</span></div>
      <div class="next-move">${icon('trend')} Your plan is ready, opening the account is the next step <span class="nm-cta" onclick="moduleToast('Account opening')">Open account ›</span></div>`;
  }
  return `<div class="subline">Start investing, or browse model portfolios.</div>
    <div class="next-move">${icon('trend')} Build your plan <span class="nm-cta" onclick="startJourneyFromDash('wealth')">Start investing ›</span></div>`;
}
/* Goals card, matches the live "My Goals" (rows with circular icon + name + % + progress bar) */
function zbAimingFor(fed, opts){
  const g=state.goal;
  const goalRow=(name,pct,ic,col)=>`<div class="goal-row"><span class="gr-ic" style="background:${col}">${icon(ic)}</span>
    <div class="gr-body"><div class="gr-top"><span class="gr-name">${name}</span><span class="gr-pct">${pct}% completed</span></div>
      <div class="gr-bar"><i style="width:${pct}%"></i></div></div></div>`;
  if(g){
    const types = (g.types&&g.types.length)? g.types : [g.type];
    const basePct = g.started?34:6;
    const pcts=[basePct,basePct-8,basePct+6,basePct-12,basePct+2,basePct-4].map(x=>Math.max(2,x));
    const rows = types.map((t,i)=>goalRow(t, pcts[i%pcts.length], 'target', '#eaf6ff')).join('');
    return `${rows}
      ${g.target?`<div class="rowline"><span>${g.projected?'Projected target':(types.length>1?'Combined target':'Target')}</span><span class="r-amt">${cur(g.target)}${g.year?` by ${g.year}`:''}</span></div>`:`<div class="rowline"><span>Target</span><span class="r-amt muted">Add a target to track it</span></div>`}
      <div class="rowline"><span>Monthly contribution</span><span class="r-amt">${cur(g.monthly||1800)}</span></div>
      <button class="ff-btn" onclick="adjustGoal()">Adjust plan</button>`;
  }
  return `<div class="subline">Set a goal to see progress here.</div>
    <button class="ff-btn" onclick="startJourneyFromDash('save')" style="margin-top:14px">Set a goal</button>`;
}
/* Financial Fitness as a WHITE card, matches the live web app (level + score/1000 + navy bar + Level up).
   The fuller sub-score rings live in the HERO (heroFitness), per spec 3.4. */
function zbFitness(fed, opts){
  const sc=computeScore();
  if(sc.score==null){
    const move = sc.level==='income'?'Link a bank for your real score':'Add your income or link an account';
    return `<div class="ff-top"><div class="ff-level pending">Getting your score ready</div><span class="vpill outline">Beta</span></div>
      <div class="ff-num pending">— <span class="ff-max">/1000</span></div>
      <div class="ff-bar"><i style="width:0%"></i></div>
      <button class="ff-btn" onclick="pushLink()">${move}</button>
      <div class="hint" style="margin-top:10px">${sc.level==='income'?'Income only, no half-real number shown yet.':'No number until there’s enough data.'}</div>`;
  }
  const pct=Math.round(sc.score/1000*100);
  const unlocked=Object.entries(sc.subs).filter(([k,v])=>v!=null).length;
  return `<div class="ff-top"><div class="ff-level">${sc.levelLabel}</div><span class="vpill outline">Beta</span></div>
    <div class="ff-num"><span class="js-count" data-count="${sc.score}">0</span> <span class="ff-max">/1000</span></div>
    <div class="ff-bar"><i data-w="${pct}" style="width:${pct}%"></i></div>
    <div class="ff-subs">${Object.entries(sc.subs).map(([k,v])=>`<span class="ff-sub ${v==null?'locked':''}"><i style="background:${v==null?'#d5dbe1':'var(--v-green)'}"></i>${k}${v!=null?' · '+v:''}</span>`).join('')}</div>
    <button class="ff-btn" onclick="${state.linked?"moduleToast('The Financial Fitness module')":'pushLink()'}">${sc.level==='partial'?'Add investments & insurance to unlock the rest':sc.level==='full'?'Level up':'Improve your score'}</button>
    ${sc.level==='partial'?'<div class="hint" style="margin-top:8px">A firm score, still building. Add investments and insurance to complete it.</div>':''}`;
}
function renderStub(z){
  const Z=ZONES[z];
  // Whole card is the single tappable action (no duplicate CTA button; the actionable
  // checklist lives in "Complete your setup").
  const k = {whereItGoes:'spending',whatYouOwe:'debt',yourWealth:'wealth',aimingFor:'save'}[z];
  return `<button class="stub stub-click"${k?` onclick="startJourneyFromDash('${k}')"`:' disabled'}><span class="si">${icon(Z.icon)}</span>
    <div class="stub-text"><div class="st">${Z.t}</div><div class="sd">${stubCopy(z)}</div></div>
    ${k?`<span class="sr-go">${icon('chevRight')}</span>`:''}</button>`;
}
function stubCopy(z){ return {whereItGoes:'Your spending, once it\'s set up',whatYouOwe:'Your debts and payoff plan',yourWealth:'Model portfolios and investing',aimingFor:'Track a savings goal',yourMoney:'',fitness:''}[z]||''; }

/* Complete-your-setup roll-up (3.5), done vs still-worth-adding */
function rollupCard(){
  const items = [
    {z:'whereItGoes', label:'Set your budget', done: !!state.answers.spending || state.fed.whereItGoes},
    {z:'yourMoney', label:'Add income / link a bank', done: state.fed.yourMoney},
    {z:'whatYouOwe', label:'Add your debt', done: !!state.answers.debt || state.fed.whatYouOwe},
    {z:'yourWealth', label:'Start investing', done: !!(state.answers.wealth&&state.answers.wealth.portfolio)},
    {z:'aimingFor', label:'Set a goal', done: !!state.goal},
    {z:'fitness', label:'Complete your fitness profile', done: computeScore().level==='full'},
  ];
  const done=items.filter(i=>i.done).length;
  if(done===items.length) return ''; // retires when complete
  return `<div class="rollup">
    <div class="ru-head"><div class="ru-title">Complete your setup</div><div class="ru-count">${done} of ${items.length}</div></div>
    <div class="ru-items">
      ${items.map(i=>`<div class="ru-item ${i.done?'done':''}">
        <span class="ck">${i.done?icon('check'):''}</span>${i.label}
        ${i.done?'':`<span class="ru-do" onclick="startJourneyFromDash('${zoneToIntent(i.z)}')">Add ›</span>`}</div>`).join('')}
    </div>
  </div>`;
}
function zoneToIntent(z){ const i=INTENTS.find(x=>x.zone===z); return i?i.key:'understand'; }

/* dashboard-triggered actions */
function pushLink(){ openConnect({journey:primaryPick(), gated:false, onDone:()=>{ go('dashboard'); }}); }
function startJourneyFromDash(key){ // secondary set-up card / stub -> run that pick's short step in place
  startJourney(key, {fromDash:true});
}
/* Adjust plan, re-open the goal setup so the user can change or reset their goals */
function adjustGoal(){
  // Pre-load the current goal so "Adjust plan" is an EDIT (pre-filled), never a
  // blank re-pick that silently overwrites the existing goal and target.
  const g=state.goal||{}; const isRet = g.type==='Retirement'; const k = isRet?'retirement':'save';
  const a=ans(k);
  if(!isRet){
    a.goalType = (g.types&&g.types.length)? g.types.slice() : (g.type?[g.type]:(a.goalType||[]));
    if(g.year) a.when = g.year+'-01';
    if(g.target){ a.amt = g.target; a.target = g.target; }
  }
  if(g.monthly) a.monthly = g.monthly;
  if(state.riskBand!=null && a.risk==null) a.risk = state.riskBand;
  save();
  startJourneyFromDash(k);
}
/* Adjust any journey from its dashboard hero: re-enter that specific journey
   with the user's existing answers pre-filled, and return to the dashboard on
   completion (fromDash). Every green hero gets one of these, not just goals. */
function adjustJourney(k){
  if(k==='debt') seedDebtRows();                 // repopulate the manual-entry editor from saved state
  if(state.riskBand!=null){ const a=ans(k); if(a.risk==null) a.risk=state.riskBand; }
  save();
  startJourneyFromDash(k);
}
function heroAdjustBtn(k,label){ return `<button class="hero-cta hero-cta-ghost" onclick="adjustJourney('${k}')">${icon('refresh')} ${label||'Adjust'}</button>`; }
/* Sidebar: off-canvas drawer on phones, icon-rail collapse on desktop */
function toggleSidebar(){
  const app=document.querySelector('.app'); if(!app) return;
  if(window.matchMedia('(max-width:820px)').matches) app.classList.toggle('nav-open');
  else app.classList.toggle('nav-rail');
}
function closeMobileNav(){ const app=document.querySelector('.app'); if(app) app.classList.remove('nav-open'); }
/* Privacy toggle: hide/show ALL amounts across the dashboard (not just the hero) */
let HIDE_AMOUNTS=false;
function toggleHideAmounts(btn){
  const dash=document.querySelector('.dash'); if(!dash) return;
  HIDE_AMOUNTS=dash.classList.toggle('amounts-hidden');
  btn.setAttribute('aria-pressed', HIDE_AMOUNTS? 'true':'false');
  btn.title = HIDE_AMOUNTS? 'Show amounts':'Hide amounts';
}

/* ---- dashboard demo presets (3.6) ---- */
function loadDemoA(){ // single-pick budgeting, will not link (income-only)
  state = structuredClone(DEFAULT_STATE);
  Object.assign(state,{email:'demo@vault22.io',name:'Aishani',region:'SA',age:31,dob:'1995-06-15',household:'2',confidence:'Somewhat confident',
    picks:['spending'], income:32000, budgetStyle:'50/30/20',
    answers:{spending:{q1:'Monthly spending limits',q2:'Saving more'}}, linked:false, fed:{yourMoney:'income',whereItGoes:'income'}, onboardingComplete:true, metTara:true});
  save(); go('dashboard');
}
function loadDemoB(){ // multi budgeting+investing+goals, linked
  state = structuredClone(DEFAULT_STATE);
  Object.assign(state,{email:'demo@vault22.io',name:'Aishani',region:'SA',age:31,dob:'1995-06-15',household:'2',confidence:'Very confident',
    picks:['spending','wealth','save'], income:32000, budgetStyle:'50/30/20',
    answers:{spending:{q1:'Pay Yourself First',q2:'Saving more'}, wealth:{risk:3,shariah:false,portfolio:true,portfolioName:'Balanced Growth'}},
    goal:{type:'Home',target:600000,year:'2031',monthly:4200,probability:'On track'},
    linked:true, linkMethod:'bank', linkedAccounts:[{name:'FNB Cheque',bal:42350},{name:'Savings',bal:88200}],
    fed:{yourMoney:'feed',whereItGoes:'feed', partial:true}, onboardingComplete:true, metTara:true}); // What you owe left as a stub; fitness still building -> "5 of 6"
  save(); go('dashboard');
}

/* ============================================================================
   SECTION 4, The journeys
   Each journey asks 2-3 intent/preference questions; the link supplies numbers;
   old data-field tables are the no-link fallback only. Only unlinkable inputs
   (insurance presence, risk, goals) are ever asked of a linked user.
   ============================================================================ */
let JRUN = null; // {key, step, fromDash, picIndex}
function saveResume(){ if(JRUN) state._resume={key:JRUN.key, step:JRUN.step, fromDash:JRUN.fromDash, picIndex:JRUN.picIndex}; save(); }
function startJourney(key, opts){ JRUN={key, step:0, fromDash:!!(opts&&opts.fromDash), picIndex:(opts&&opts.picIndex)||0}; saveResume(); go('journey'); }

/* --------- Multi-pick walkthrough (walk EVERY pick, in priority order) ---------
   After a pick's intake completes we advance to the next picked journey whose
   intake isn't already satisfied (so shared inputs, a link, income, risk, are
   never asked twice), then land on the dashboard after the last one. */
function intakeSatisfied(key){
  switch(key){
    case 'understand':  return state.linked || state.income!=null;
    case 'spending':    return !!state.fed.whereItGoes;
    case 'health':      return !!state.fed.fitness;
    case 'debt':        return !!state.fed.whatYouOwe;
    case 'wealth':      return !!(state.answers.wealth && state.answers.wealth.portfolio);
    case 'save':        return !!state.goal;
    case 'retirement':  return !!(state.goal && state.goal.type==='Retirement');
    default:            return false;
  }
}
function nextUnrunPick(fromIdx){
  const picks = state.picks && state.picks.length ? state.picks : ['understand'];
  for(let i=fromIdx;i<picks.length;i++){ if(!intakeSatisfied(picks[i])) return i; }
  return -1;
}
/* Every journey ends here: chain to the next pick, or land on the dashboard. */
function journeyDone(){
  if(!JRUN || JRUN.fromDash){ landDashboard(); return; }   // dashboard-triggered set-up never chains
  const idx = JRUN.picIndex!=null ? JRUN.picIndex : 0;
  const ni = nextUnrunPick(idx+1);
  if(ni>=0) startJourney(state.picks[ni], {picIndex:ni});
  else landDashboard();
}
function jGo(s){ JRUN.step=s; saveResume(); go('journey'); }
function jNext(){ jGo(JRUN.step+1); }
function jBack(){ if(!JRUN||JRUN.step<=0){ if(JRUN&&JRUN.fromDash) go('dashboard'); else go('fork'); } else jGo(JRUN.step-1); }
function ans(k){ return state.answers[k] || (state.answers[k]={}); }
function setAns(k, field, val, multi){
  const a=ans(k);
  if(multi){ a[field]=a[field]||[]; const i=a[field].indexOf(val); i>=0?a[field].splice(i,1):a[field].push(val); }
  else a[field]=val;
  save();
  // Re-render in place and KEEP the scroll position, so tapping an option never
  // throws the user back to the top of the form (go() would scroll to 0).
  const sc=document.querySelector('.onb__form'); const y=sc?sc.scrollTop:0;
  // Snapshot any values the user has typed so the re-render can't wipe them
  // (e.g. typing an amount, then toggling a goal or insurance chip).
  const snap={};
  document.querySelectorAll('.onb__form input, .onb__form select').forEach(el=>{
    if(el.id) snap[el.id] = (el.type==='checkbox') ? el.checked : el.value;
  });
  render();
  Object.entries(snap).forEach(([id,v])=>{ const el=document.getElementById(id); if(!el) return;
    if(el.type==='checkbox') el.checked=v; else if(v!=='' && v!=null) el.value=v; });
  const sc2=document.querySelector('.onb__form'); if(sc2) sc2.scrollTop=y;
}
function qBlock(k, field, label, opts, multi){
  const a=ans(k); const cur=a[field];
  return `<div class="field qblock"><label class="qlabel">${label}${multi?' <span class="hint">· choose any</span>':''}</label>
    <div class="opt-list">${opts.map(o=>{
      const sel = multi? (cur||[]).includes(o) : cur===o;
      const esc=o.replace(/'/g,"\\'");
      return `<button class="opt ${sel?'sel':''}" onclick="setAns('${k}','${field}','${esc}',${!!multi})">
        <span class="opt-body"><span class="opt-t" style="font-size:14px">${o}</span></span>
        <span class="opt-check">${icon('check')}</span></button>`;}).join('')}</div></div>`;
}
function jShell(k, {title, sub, body, cta, onNext, extra}){
  const j = intent(k);
  // Back sits inline (next to Continue), never in the top-left, once inside a journey.
  const actions = onNext
    ? `<div class="actions actions-row" style="margin-top:16px">
         <button class="btn btn-back" onclick="jBack()">${icon('back')} Back</button>
         <button class="btn btn-primary" onclick="${onNext}">${cta||'Continue'}</button>
       </div>`
    : `<div class="actions" style="margin-top:12px"><button class="btn btn-back" onclick="jBack()">${icon('back')} Back</button></div>`;
  return onbShell({ back:false, logo:false, segs:null, body:`
    <div class="onb__logo" style="margin-top:6px"><svg class="mark" viewBox="0 0 64 64"><use href="#v22mark"/></svg></div>
    <div class="pill-note" style="margin:0 auto 6px;display:flex">${icon(j.icon)} ${j.label}</div>
    <h2 class="screen-title">${title}</h2>
    ${sub?`<div class="screen-sub">${sub}</div>`:''}
    ${body}
    ${actions}
    ${extra||''}
  `});
}
/* connect-push panel shared by gated (budgeting) & encouraged journeys.
   Renders its own primary "Link a bank" + a working honest-fallback link (onAlt). */
function connectPushPanel(k, {gated, quiet, onAlt}){
  return `
    <div class="setup-card" style="border-color:${gated?'var(--v-green)':'#cdeee1'}">
      <div class="sc-head">${icon('bank')} <b>${gated?'Link your bank, this is the real budget':'Link your bank for the real picture'}</b></div>
      <div class="md muted small">${gated?'Your categorised transaction feed IS your budget. A few typed numbers are a rough estimate by comparison.':'Strongly recommended. Everything fills in from your feed.'}</div>
      <div class="actions" style="margin-top:12px"><button class="btn btn-primary" onclick="jConnect('${k}',${!!gated})">${icon('bank')} Link a bank</button></div>
    </div>
    <div class="center"><button class="btn-link" onclick="${onAlt||`jConnect('${k}',${!!gated})`}">${quiet||'Continue without linking'} ›</button></div>`;
}
function jConnect(k, gated){
  openConnect({journey:k, gated, quietLabel: gated?'Give us a few numbers instead':'Continue without linking', onDone:(method,outcome)=>{
    if(method==='bank' || method==='statement'){ // feed satisfies everything
      jAfterLink(k, true);
    } else if(method==='income'){ jAfterLink(k, false, true); }
    else { jAfterLink(k, false, false); } // 'none'
  }});
}
/* Health "fill it in yourself", skip the link, still ask the always-asked risk + insurance (staged essentials shown because unlinked) */
function jHealthManual(){ if(JRUN) JRUN.linked=false; jGo(2); }
/* J-Understand "not now": an honest income-anchored view (an optional-step skip). */
function skipUnderstandConnect(){ track('step_skipped',{step:'connect'}); journeyDone(); }
/* After connect resolves, route each journey to its remaining steps */
function jAfterLink(k, linked, incomeOnly){
  const A=ans(k);
  if(k==='spending'){
    if(linked){ state.fed.whereItGoes='feed'; journeyDone(); }
    else { jGo(2); } // six no-link fields (mandatory fallback numbers)
  } else if(k==='understand'){
    journeyDone();
  } else if(k==='health'){
    // always: risk + insurance nudge; staged essentials only if not linked
    JRUN.linked=linked; jGo(2);
  } else if(k==='debt'){
    if(linked){ state.fed.whatYouOwe='feed'; journeyDone(); }
    else { jGo(2); } // quick read + manual entry
  } else { journeyDone(); }
}

SCREENS.journey = () => {
  if(!JRUN) return SCREENS.fork();
  const fn = {understand:jUnderstand, spending:jSpending, health:jHealth, debt:jDebt, wealth:jWealth, save:jSave, retirement:jRetirement}[JRUN.key];
  return fn? fn(JRUN.step) : SCREENS.dashboard();
};
/* Re-hydrate the debt manual-entry step so added rows and an earlier quick read
   survive a refresh, a Back/return, or re-entry from the dashboard "Adjust debts". */
SCREEN_AFTER['journey'] = () => {
  if(!JRUN || JRUN.key!=='debt' || JRUN.step!==2) return;
  seedDebtRows(); renderDebtRows();
  const a=state.answers.debt||{};
  const read=document.getElementById('d-read');
  if(read && a.bucket){ read.innerHTML = debtBuckets(a.bucket); }
};

/* ---- J-Understand (asks nothing) ---- */
function jUnderstand(step){
  return jShell('understand', {
    title:'See everything in one place',
    sub:'No questions here, we\'ll connect, then show your net worth, cashflow and Financial Fitness Score, and Tara reads back your biggest opportunity.',
    body:`
      <div class="setup-card">
        <div class="sc-head">${icon('eye')} <b>Show me my money</b></div>
        <div class="md muted small">Link an account and your whole picture appears. Strongly offered, never required.</div>
        <div class="actions" style="margin-top:12px"><button class="btn btn-primary" onclick="jConnect('understand',false)">${icon('bank')} Connect an account</button></div>
      </div>
      <div class="center"><button class="btn-link" onclick="skipUnderstandConnect()">Not now, take me to my dashboard ›</button></div>
    `,
    onNext:null, extra:''
  });
}

/* ---- J-Spending ---- */
function jSpending(step){
  if(step===0) return jShell('spending', {
    title:'Get control of your spending',
    sub:'Two quick questions, these set your budget\'s shape and Tara\'s focus. We ask them whether or not you link.',
    body:
      qBlock('spending','q1','How would you like to budget?',['Hands off / automated insights','Monthly spending limits','Pay Yourself First'])+
      qBlock('spending','q2','What would make the biggest difference?',['Spending less','Saving more','Cutting wasteful subscriptions','Paying down debt']),
    cta:'Continue', onNext:"spendingNext()"
  });
  if(step===1) return jShell('spending', {
    title:'Now let\'s get your real numbers',
    sub:'The real budget is your categorised transaction feed. Linking is the primary path here, and budgeting needs a link OR a few numbers, not neither.',
    body: connectPushPanel('spending',{gated:true, quiet:'Give us a few numbers instead', onAlt:"jGo(2)"}),
    onNext:null,
    extra:`<div class="hint center" style="margin-top:8px">Budgeting needs a link or a few quick numbers, either one works.</div>`
  });
  if(step===2){ // six no-link fields (deliberately thin fallback)
    const a=ans('spending');
    return jShell('spending', {
      title:'A quick starter budget',
      sub:'Six summary numbers give you a rough starter. Thin by design, link any time for the real feed.',
      body:`
        ${sixField('sp-income','Monthly income (after tax)', state.income)}
        <div class="field"><label>Budgeting style</label>
          <div class="chips">${['50/30/20 (default)','Zero-based','Pay Yourself First'].map(s=>`<button class="chip ${a.q1s===s?'sel':''}" onclick="setAns('spending','q1s','${s}')">${s}</button>`).join('')}</div>
          <div class="hint" style="margin-top:6px">Prefer a custom split? You can set that later in Budget.</div></div>
        ${sixField('sp-exp','Rough monthly expenses')}
        ${sixField('sp-sav','Current savings')}
        ${sixField('sp-debt','Total debt owed')}
        <div class="field"><label>Pay-day (day of month)</label><input class="input" id="sp-payday" type="number" min="1" max="31" placeholder="25"></div>
      `,
      cta:'See my budget', onNext:"spendingFallbackDone()",
      extra:`<div class="hint center" style="margin-top:6px">You can fine-tune categories and targets any time in Budget.</div>`
    });
  }
}
function spendingNext(){ const a=ans('spending'); if(!a.q1){ toast('Pick how you\'d like to budget'); return;} track('budget_style_chosen',{style:a.q1}); jGo(1); }
function sixField(id,label,val){ return `<div class="field"><label>${label}</label><input class="input" id="${id}" aria-label="${label}" type="number" placeholder="${market().cur}0" value="${val||''}"></div>`; }
function spendingFallbackDone(){
  const inc=parseFloat((document.getElementById('sp-income')||{}).value);
  if(!isNaN(inc) && inc>0) state.income = inc;             // ignore blank / 0 / negative
  const pd=parseInt((document.getElementById('sp-payday')||{}).value,10);
  if(pd>=1 && pd<=31) state.payday=pd;
  state.fed.whereItGoes = 'income';                        // starter budget (thin) always shows
  if(state.income>0) state.fed.yourMoney = state.fed.yourMoney||'income'; // never anchor net worth on a zero
  save(); journeyDone();
}

/* ---- J-Health (flagship) ---- */
function jHealth(step){
  if(step===0) return jShell('health', {
    title:'Improve your financial health',
    sub:'Three quick, subjective questions steer your action plan and what Tara leads with.',
    body:
      qBlock('health','q1','How would you rate your financial health?',['Excellent','Good','Fair','Poor'])+
      qBlock('health','q2','Which area concerns you most?',['Spending','Debt','Savings','Investments','Retirement','Insurance'])+
      qBlock('health','q3','Do you currently save regularly?',['Yes','Sometimes','No']),
    cta:'Continue', onNext:"healthNext()"
  });
  if(step===1) return jShell('health', {
    title:'Get your real score',
    sub:'Linking is the richest route to a real score, income, expenses, savings and debt all come from your feed. Or fill it in yourself.',
    body: connectPushPanel('health',{gated:false, quiet:'Or fill it in yourself', onAlt:"jHealthManual()"}),
    onNext:null
  });
  if(step===2){ // always asked: risk read + insurance nudge; staged essentials only if not linked
    const linked = JRUN.linked;
    const ah=ans('health'); const riskReused = state.riskBand!=null;
    const riskBlock = (riskReused && !ah.editRisk)
      ? `<div class="setup-card"><div class="sc-head">${icon('shield')} <b>Risk profile carried over</b></div>
           <div class="md muted small">You already shared how you feel about market risk, so there's no need to answer this again.</div>
           <div class="actions" style="margin-top:12px"><button class="btn btn-ghost" onclick="setAns('health','editRisk',true)">Change it</button></div></div>`
      : qBlock('health','risk','Your risk & style, how would you react to a market dip?',['Sell to avoid loss','Wait it out','Buy more while it\'s cheap']);
    return jShell('health', {
      title:'A couple of things only you can tell us',
      sub:'These are unlinkable, so we always ask them, even if you linked.',
      body:`
        ${riskBlock}
        <div class="field"><label>Which of these do you have? <span class="hint">· a light nudge, this does not itself score</span></label>
          <div class="chips">${['Life','Medical','Disability','Short-term'].map(t=>{const a=ans('health');const s=(a.ins||[]).includes(t);return `<button class="chip ${s?'sel':''}" onclick="setAns('health','ins','${t}',true)">${t}</button>`;}).join('')}</div>
          <div class="callout">${icon('info')} Having cover is a good start. We'll help you complete your protection profile, cover amounts and tiers, to score it.</div>
        </div>
        ${linked?'':`<div class="divider"></div><div class="pill-note" style="display:flex;margin-bottom:10px">${icon('info')} No link, we'll ask the essentials, show a first score, then let you add more to sharpen it (staged)</div>
          ${sixField('h-inc','Monthly income (after tax)',state.income)}${sixField('h-exp','Monthly expenses')}${sixField('h-sav','Current savings')}${sixField('h-debt','Debt balance + repayments')}`}
      `,
      cta:'See my score', onNext:"healthDone()",
      extra:`<div class="hint center" style="margin-top:6px">You can add cover amounts and go deeper on each score later.</div>`
    });
  }
}
function healthNext(){ const a=ans('health'); if(!a.q1||!a.q2){ toast('Answer the first questions'); return;} track('health_intent_set',{rating:a.q1,concern:a.q2}); jGo(1); }
function healthDone(){
  const a=ans('health');
  if(a.risk) { state.risk=state.risk||{reaction:a.risk}; const map={'Sell to avoid loss':2,'Wait it out':3,"Buy more while it's cheap":4}; if(state.riskBand==null) state.riskBand=map[a.risk]||3; track('risk_profile_set',{reaction:a.risk, band:state.riskBand}); }
  if(a.ins&&a.ins.length) track('insurance_set',{count:a.ins.length});
  if(!JRUN.linked){ const inc=parseFloat((document.getElementById('h-inc')||{}).value); if(!isNaN(inc)&&inc>0)state.income=inc; state.fed.fitness='manual';
    if(state.income>0) state.fed.yourMoney = state.fed.yourMoney||'income'; } // income given here also anchors Your money (ask once, reuse)
  else state.fed.fitness='feed';
  track('score_revealed',{score:computeScore().score, level:computeScore().levelLabel, confidence:state.confidence||null});
  save(); journeyDone();
}

/* ---- J-Debt ---- */
function jDebt(step){
  if(step===0) return jShell('debt', {
    title:'Get out of debt',
    sub:'A few calm questions. Bands, not exact figures, kinder, and enough to shape your plan.',
    body:
      qBlock('debt','types','What types of debt do you have?',['Credit cards','Personal loans','Car finance','Mortgage','Student loans'],true)+
      qBlock('debt','priority','What is your biggest priority?',['Lower monthly payments','Become debt free','Improve credit score'])+
      qBlock('debt','band', debtBandLabel(), debtBands())+
      `<div class="hint" style="margin-top:-8px">A rough range is all we need here, this stays directional.</div>`,
    cta:'Continue', onNext:"debtNext()"
  });
  if(step===1) return jShell('debt', {
    title:'See where you stand',
    sub:'Linking adds recurring-payment suggestions and the wider picture, but the manual path is a full, equal route to a real payoff plan. Encouraged, not forced.',
    body: connectPushPanel('debt',{gated:false, quiet:'Or add your income for a quick read', onAlt:"jGo(2)"}),
    onNext:null
  });
  if(step===2){ // no-link: quick read (band+income) + fuller manual entry
    return jShell('debt', {
      title:'Your debt picture',
      sub:'Two honest no-link routes, a quick directional read now, or enter your debts for a real payoff plan.',
      body:`
        <div class="setup-card">
          <div class="sc-head">${icon('coins')} <b>Quick read</b></div>
          <div class="md muted small">Your band and income give a calm, directional sense of how heavy this looks, no exact figure, no verdict labels.</div>
          <div class="field" style="margin-top:12px"><label>Monthly income (after tax)</label>
            <input class="input" id="d-inc" aria-label="Monthly income after tax" type="number" min="1" placeholder="${market().cur}0" value="${state.income||''}" oninput="debtIncomeInput()"></div>
          <div class="actions" style="margin-top:10px"><button class="btn btn-ghost" onclick="debtQuickRead()">Show my quick read</button></div>
          <div id="d-read"></div>
        </div>
        <div class="setup-card">
          <div class="sc-head">${icon('chain')} <b>Add your debts (a real plan)</b></div>
          <div class="md muted small">Enter balances, rates and repayments to get a real payoff plan without linking, via the Debt module's Add Debt form.</div>
          <div id="d-manual"></div>
          <div class="actions" style="margin-top:10px"><button class="btn btn-ghost" onclick="addDebtRow()">${icon('plus')} Add a debt</button></div>
        </div>
      `,
      cta:'See my dashboard', onNext:"debtDone()",
      extra:`<div class="hint center" style="margin-top:20px">Your full payoff plan and rate detail live in the Debt module.</div>`
    });
  }
}
function debtBandLabel(){ return 'Roughly how much do you owe in total?'; }
/* Region-aware, self-explanatory ranges (no opaque "Band 1", no placeholders) */
function debtBandsFor(){
  const r=state.region;
  if(r==='UAE')    return {labels:['Under AED 25k','AED 25k–100k','AED 100k–250k','AED 250k+'], mids:[12000,60000,175000,400000]};
  if(r==='GLOBAL') return {labels:['Under $5k','$5k–25k','$25k–75k','$75k+'],                  mids:[2500,15000,50000,120000]};
  return {labels:['Under R50k','R50k–200k','R200k–500k','R500k+'],                              mids:[25000,125000,350000,750000]};
}
function debtBands(){ return debtBandsFor().labels; }
function debtNext(){ const a=ans('debt'); if(!a.types||!a.types.length){ toast('Pick at least one debt type'); return;} track('debt_intent_set',{types:a.types,priority:a.priority,band:a.band}); jGo(1); }
function debtIncomeInput(){ const r=document.getElementById('d-read'); if(r && r.innerHTML.trim()){ const v=parseFloat((document.getElementById('d-inc')||{}).value); if(v>0) debtQuickRead(); } }
function debtQuickRead(){
  const inc=parseFloat((document.getElementById('d-inc')||{}).value);
  if(isNaN(inc)||inc<=0){ shake('d-inc'); return; }
  state.income=inc;
  const a=ans('debt'); const B=debtBandsFor(); const bandIdx=Math.max(0,B.labels.indexOf(a.band));
  const debtMid=B.mids[bandIdx]||B.mids[1];
  const ratio=debtMid/(inc*12);                                   // total debt as a share of yearly income
  const bucket = ratio<0.5?'manageable':ratio<1.5?'stretched':'heavy';
  a.bucket=bucket; save();
  const label={manageable:'Manageable',stretched:'Stretched',heavy:'Heavy'}[bucket];
  document.getElementById('d-read').innerHTML =
    `<div class="qr-verdict">Your read at ${cur(inc)}/month: <b>${label}</b></div>` +
    debtBuckets(bucket) +
    `<div class="hint" style="margin-top:8px">Directional read from about ${cur(debtMid)} of debt against ${cur(inc)}/month income.</div>`;
}
let debtRows=[];
/* debtRows mirrors state.answers.debt.rows so add / edit / delete survive a
   refresh, a navigation away and back, and re-entry via "Adjust debts". */
function seedDebtRows(){ const a=state.answers.debt||{}; debtRows = Array.isArray(a.rows) ? a.rows.map(r=>({...r})) : []; }
function persistDebtRows(){ ans('debt').rows = debtRows.map(r=>({...r})); save(); }
function addDebtRow(){ if(debtRows.length>=10){ toast('You can add up to 10 debts here'); return; } debtRows.push({balance:'',rate:'',repay:''}); persistDebtRows(); renderDebtRows(); }
function removeDebtRow(i){ debtRows.splice(i,1); persistDebtRows(); renderDebtRows(); }
function debtRowInput(i,field,val){ if(!debtRows[i])return; debtRows[i][field]=(val||'').replace(/[^0-9.]/g,''); persistDebtRows(); }
function renderDebtRows(){
  const el=document.getElementById('d-manual'); if(!el)return;
  if(!debtRows.length){ el.innerHTML=`<div class="hint" style="margin:8px 0 2px">No debts added yet. Add one below to build a real payoff plan.</div>`; return; }
  el.innerHTML = debtRows.map((r,i)=>`<div class="debt-row">
    <input class="input" type="number" inputmode="decimal" min="0" step="any" aria-label="Balance" placeholder="Balance" value="${r.balance}" oninput="debtRowInput(${i},'balance',this.value)">
    <input class="input" type="number" inputmode="decimal" min="0" step="any" aria-label="Interest rate percent" placeholder="Rate %" value="${r.rate}" oninput="debtRowInput(${i},'rate',this.value)">
    <input class="input" type="number" inputmode="decimal" min="0" step="any" aria-label="Monthly repayment" placeholder="Repay" value="${r.repay}" oninput="debtRowInput(${i},'repay',this.value)">
    <button class="debt-del" aria-label="Remove this debt" title="Remove this debt" onclick="removeDebtRow(${i})">✕</button>
  </div>`).join('');
}
function debtDone(){
  const a=ans('debt');
  if(debtRows.length){ a.manual=true; a.total=debtRows.reduce((s,r)=>s+(parseFloat(r.balance)||0),0); track('debt_entered_manually',{count:debtRows.length}); }
  state.fed.whatYouOwe = a.manual?'manual':(a.bucket?'quick':false);
  if(state.income>0) state.fed.yourMoney = state.fed.yourMoney||'income'; // income given for the quick read also anchors Your money
  save(); journeyDone();
}

/* ---- J-Wealth engine (shared by Wealth / Save / Retirement) ---- */
function wealthEngine(k, step, overlay){
  // overlay: null (grow), 'save', 'retirement'
  const goalOpts = ['General growth','Home','Retirement','Education','Emergency','Custom'];
  if(step===0){
    // objective, for save/retirement the door pre-sets it
    if(overlay==='save') return jShell(k,{title:'Save for a goal', sub:'What are you saving for, by when, and how much? You can pick more than one.',
      body:
        qBlock(k,'goalType','What are your goals?',['Emergency fund','Home','Education','Wedding','Travel','Other'],true)+
        `<div class="field"><label>When do you want to achieve it?</label><input class="input" id="w-when" type="month" min="${curMonthISO()}" value="${(ans(k).when)||''}">
          <div id="w-when-err" class="hint" style="display:none;color:var(--red);margin-top:6px">Please choose a date in the future.</div></div>`+
        `<div class="field"><label>How much do you think you'll need?</label><input class="input" id="w-amt" type="number" min="1" placeholder="${market().cur}0" value="${(ans(k).amt)||''}"></div>`,
      cta:'Continue', onNext:`wealthObjectiveNext('${k}','save')`});
    if(overlay==='retirement') return jShell(k,{title:'Plan for retirement', sub:'A special long-horizon goal, two quick inputs.',
      body:
        `<div class="field"><label>When do you hope to retire?</label><input class="input" id="w-age" type="number" placeholder="Target age, e.g. 65" value="65"></div>`+
        qBlock(k,'lifestyle','What kind of retirement are you aiming for?',['Modest / essentials covered','Comfortable','Aspirational']),
      cta:'Continue', onNext:`wealthObjectiveNext('${k}','retirement')`});
    return jShell(k,{title:'Grow your wealth', sub:'What are you investing toward? This sets your target, projection and recommended portfolio.',
      body: qBlock(k,'objective','Your objective',goalOpts),
      cta:'Continue', onNext:`wealthObjectiveNext('${k}',null)`});
  }
  if(step===1){ // risk + preferences (asked once across journeys)
    const a=ans(k);
    const bandNames=['Ultra-Low','Cautious','Balanced','Growth','Aggressive']; // aligned to the live investment-style tiers used by the quiz
    const reused = state.riskBand!=null;
    if(reused && a.risk==null) a.risk=state.riskBand;          // carry the earlier read forward
    const showChips = !reused || a.editRisk;                   // don't re-ask unless they choose to change
    const riskField = showChips
      ? `<div class="field qblock" style="margin-bottom:0"><label class="qlabel">Your risk &amp; style</label>
           <div class="chips">${[1,2,3,4,5].map(b=>`<button class="chip ${a.risk===b?'sel':''}" onclick="setAns('${k}','risk',${b})">${bandNames[b-1]}</button>`).join('')}</div>
           <div class="center" style="margin-top:10px"><button class="btn-link" onclick="openRiskQuiz('${k}')">Help me decide (quiz) ›</button></div></div>`
      : `<div class="setup-card"><div class="sc-head">${icon('shield')} <b>Risk profile carried over</b></div>
           <div class="md muted small">You're set to <b>${bandNames[(a.risk||3)-1]}</b> from your earlier answers, so there's no need to do the risk assessment again.</div>
           <div class="actions" style="margin-top:12px"><button class="btn btn-ghost" onclick="setAns('${k}','editRisk',true)">Change my risk level</button></div></div>`;
    return jShell(k,{title:'Your risk & style', sub: reused && !a.editRisk ? 'We reuse the risk read you already gave, no need to repeat it.' : 'One risk-and-style read across five bands, or let us help you decide.',
      body:`
        ${riskField}
        <label class="opt" style="cursor:pointer;margin-top:16px"><input type="checkbox" ${a.shariah?'checked':''} onchange="setAns('${k}','shariah',this.checked)" style="width:18px;height:18px;accent-color:var(--v-green)">
          <span class="opt-body"><span class="opt-t" style="font-size:14px">Shariah-compliant only</span><span class="opt-d">Filters to the Shariah model-portfolio set</span></span></label>
        <div class="pill-note" style="display:flex;margin-top:12px">${icon('info')} Currency &amp; market: ${market().curName}, from your region.</div>
      `,
      cta:'Continue', onNext:`wealthRiskNext('${k}','${overlay||''}')`});
  }
  if(step===2){ // setup: funding
    return jShell(k,{title:'Set up your plan', sub:'How would you like to fund it? We\'ll show a live goal-probability read.',
      body:`
        ${overlay!=='retirement'?`<div class="field"><label>Target amount</label><input class="input" id="w-target" type="number" placeholder="${market().cur}0" value="${(ans(k).amt)||''}"></div>`:''}
        <div class="field"><label>Lump sum (optional)</label><input class="input" id="w-lump" type="number" placeholder="${market().cur}0"></div>
        <div class="field"><label>Monthly contribution</label><input class="input" id="w-monthly" type="number" placeholder="${market().cur}0" value="1800"></div>
        <div class="callout">${icon('target')} Live read: on current inputs you're <b>on track</b> to your goal. Nudge the numbers to watch it change.</div>
      `,
      cta:'See my recommended portfolio', onNext:`wealthSetupNext('${k}','${overlay||''}')`});
  }
  if(step===3){ // suggested portfolio, the aha, before the account-opening wall
    const a=ans(k); const band=a.risk||3; const name=['Capital Preservation','Cautious','Balanced Growth','Growth','High Growth'][band-1];
    return jShell(k,{title:'Your recommended portfolio', sub:'The aha, a real model portfolio for your objective. Opening the account comes after.',
      body:`
        <div class="setup-card">
          <div class="sc-head"><span class="rankbadge" style="background:var(--v-green);color:var(--navy)">${band}</span><b>${name}${a.shariah?' · Shariah':''}</b></div>
          <div class="rowline"><span>Risk band</span><span class="r-amt">${band}/5</span></div>
          <div class="rowline"><span>Recommended term</span><span class="r-amt">${band<=2?'1–3 yrs':band===3?'3–5 yrs':'5+ yrs'}</span></div>
          <div class="rowline"><span>Past 5y return (illustrative)</span><span class="r-amt" style="color:var(--v-green-700)">+${(5+band*1.5).toFixed(1)}% p.a.</span></div>
          <div class="rowline"><span>Allocation</span><span class="r-amt">${band*15+10}% growth / ${100-(band*15+10)}% defensive</span></div>
          <div class="hint" style="margin-top:8px">Why: matched to your ${band}/5 risk and ${overlay==='retirement'?'retirement horizon':'timeframe'}.</div>
          <div class="actions" style="margin-top:14px"><button class="btn btn-ghost" onclick="openFactSheet('${k}')">${icon('doc')} View fact sheet &amp; past returns</button></div>
        </div>
      `,
      cta:'Select this plan for me', onNext:`wealthPortfolioDone('${k}','${overlay||''}')`});
  }
}
function jWealth(step){ return wealthEngine('wealth', step, null); }
function jSave(step){ return wealthEngine('save', step, 'save'); }
function jRetirement(step){ return wealthEngine('retirement', step, 'retirement'); }
function wealthObjectiveNext(k, overlay){
  const a=ans(k);
  if(overlay==='save'){
    a.amt=parseFloat((document.getElementById('w-amt')||{}).value)||null;
    a.when=(document.getElementById('w-when')||{}).value;
    const goals = Array.isArray(a.goalType)? a.goalType : (a.goalType?[a.goalType]:[]);
    if(!goals.length){toast('Pick at least one goal');return;}
    if(!a.when){ toast('Choose a target date'); shake('w-when'); return; }
    if(a.when < curMonthISO()){ const e=document.getElementById('w-when-err'); if(e)e.style.display='block'; shake('w-when'); return; }
    if(!(a.amt>0)){ toast('Enter how much you\'ll need'); shake('w-amt'); return; }
    track('goal_chosen',{goal_type:goals});
  }
  else if(overlay==='retirement'){
    a.retireAge=parseFloat((document.getElementById('w-age')||{}).value)||null;
    if(!(a.retireAge>0)){ toast('Enter your target retirement age'); shake('w-age'); return; }
    if(state.age!=null && a.retireAge<=state.age){ toast('Choose a retirement age in the future'); shake('w-age'); return; }
    if(!a.lifestyle){ toast('Pick the kind of retirement you want'); return; }
    track('retirement_intent_set',{target_age:a.retireAge});
  }
  else { if(!a.objective){toast('Pick an objective');return;} }
  track('invest_objective_set',{goal_type:a.objective||a.goalType||'retirement', is_shariah:!!a.shariah}); save(); jGo(1);
}
function wealthRiskNext(k, overlay){ const a=ans(k); if(!a.risk){toast('Pick a risk band');return;} state.riskBand=a.risk; if(!state.risk)state.risk={reaction:'(from investing)'}; track('risk_profile_set',{horizon:overlay||'growth', band:a.risk}); jGo(2); }

/* Help-me-decide quiz. Mirrors the live Vault22 "Investment Style" assessment:
   three questions, one per step, five options each, a 3-segment progress bar,
   auto-advance on selection, then a suggested investment style (used as the band). */
let RISKQUIZ=null;
const RQ = [
  {id:'goal', q:'What is your primary investment goal?', opts:[
    ['I want to preserve my capital',1],
    ['I want moderate growth with low risk',2],
    ['I want balanced growth with moderate risk',3],
    ['I want aggressive growth with higher risk',4],
    ['I want to maximise returns and accept the highest risk',5]]},
  {id:'attitude', q:'What is your attitude towards investment risk?', opts:[
    ['I prefer to avoid risk as much as possible',1],
    ["I'm willing to accept some risk for potential returns",2],
    ["I'm comfortable with moderate risk for higher potential returns",3],
    ["I'm willing to take significant risks for potentially higher returns",4],
    ['I actively seek high-risk opportunities for maximum returns',5]]},
  {id:'reaction', q:'How would you react if your investments fell in value by 20% over the next 6 months?', opts:[
    ['I would sell immediately to limit my losses',1],
    ['I would be concerned but hold onto my investments',2],
    ['I would not be concerned and continue holding my investments',3],
    ['I would view it as an opportunity to buy more of the same investments',4],
    ['I would become more aggressive to take advantage of future growth',5]]},
];
const QUIZ_STYLES=[
  {tier:'Ultra-Low', name:'Safety First',         desc:'You value capital preservation and stability, opting for an emphasis on savings that avoids the markets entirely.'},
  {tier:'Cautious',  name:'Protect & Preserve',   desc:"You're comfortable with some market movement, but preserving your capital remains your priority, with steady growth over time."},
  {tier:'Balanced',  name:'Balanced Approach',    desc:"You're comfortable balancing growth and stability, accepting some market ups and downs to reach your long-term goals."},
  {tier:'Growth',    name:'Build for Growth',     desc:"You're focused on long-term growth and are comfortable riding out market swings for a higher potential return."},
  {tier:'Aggressive',name:'Build for the Future', desc:"You're focused on long-term capital growth and are comfortable with significant short-term market fluctuations along the way."},
];
function openRiskQuiz(k){ closeOtherOverlays(); RISKQUIZ={k, i:0, a:{}}; renderRiskQuiz(true); }
/* H1/H2: the modal shell (.modal-back/.modal) is mounted ONCE. Question changes
   repaint only the inner body; selecting an option updates only classes in place.
   The container is never recreated, so pop/fade never replay and scroll never resets. */
function renderRiskQuiz(fresh){
  const mr=document.getElementById('modal-root'); if(!mr) return; if(!RISKQUIZ){ mr.innerHTML=''; return; }
  if(RISKQUIZ.i>=RQ.length) return renderQuizResult();
  let shell=mr.querySelector('.rq-modal');
  if(!shell || fresh){
    mr.innerHTML = `<div class="modal-back"><div class="modal rq-modal" role="dialog" aria-modal="true" aria-label="Help me decide, investment style quiz">
      <button class="mh-close" aria-label="Close" onclick="closeRiskQuiz()">✕</button>
      <div class="rq-inner" id="rq-inner"></div>
    </div></div>`;
  } else {
    shell.classList.remove('rq-result');
  }
  paintQuizQuestion(true);
}
function paintQuizQuestion(changedQuestion){
  const inner=document.getElementById('rq-inner'); if(!inner) return;
  const {i,a}=RISKQUIZ; const q=RQ[i]; const chosen=a[q.id]!=null; const last=i===RQ.length-1;
  const seg=RQ.map((_,idx)=>`<span class="rq-seg ${idx<i||(idx===i&&chosen)?'on':''}"></span>`).join('');
  inner.innerHTML = `
    ${i>0?`<button class="rq-topback" aria-label="Back to the previous question" onclick="quizBack()">${icon('back')}</button>`:''}
    <div class="rq-q">${q.q}</div>
    <div class="rq-progress">${seg}</div>
    <div class="rq-opts">${q.opts.map(([l,v])=>`<button class="rq-opt ${a[q.id]===v?'sel':''}" data-v="${v}" onclick="setRiskQuiz('${q.id}',${v})">
        <span class="rq-radio"></span><span class="rq-opt-t">${l}</span></button>`).join('')}</div>
    <div class="rq-nav">
      <button class="btn btn-primary rq-continue" ${chosen?'':'disabled'} onclick="quizNext()">${last?'See my result':'Continue'}</button>
    </div>`;
  if(changedQuestion){ const m=document.querySelector('.rq-modal'); if(m) m.scrollTop=0; } // a NEW question starts at the top; a selection never scrolls
}
/* Selecting an option touches only the option state, the current progress dot and
   the Continue button, in place. No innerHTML rewrite of the shell, no scroll change. */
function updateQuizSelection(){
  const {i,a}=RISKQUIZ; const q=RQ[i]; const chosen=a[q.id]!=null;
  document.querySelectorAll('.rq-opt').forEach(btn=>btn.classList.toggle('sel', Number(btn.dataset.v)===a[q.id]));
  const segs=document.querySelectorAll('.rq-seg'); if(segs[i]) segs[i].classList.toggle('on', chosen);
  const cont=document.querySelector('.rq-continue'); if(cont) cont.disabled=!chosen;
}
function setRiskQuiz(id,v){
  if(!RISKQUIZ)return;
  if(RISKQUIZ.a[id]===v) delete RISKQUIZ.a[id];   // tap a selected option again to deselect it
  else RISKQUIZ.a[id]=v;
  updateQuizSelection();                          // in place: instant, no remount, no scroll reset, no auto-advance
}
function quizNext(){ if(!RISKQUIZ)return; const q=RQ[RISKQUIZ.i]; if(RISKQUIZ.a[q.id]==null) return; RISKQUIZ.i++; renderRiskQuiz(); }
function quizBack(){ if(RISKQUIZ && RISKQUIZ.i>0){ RISKQUIZ.i--; renderRiskQuiz(); } }
function quizBand(){ const v=Object.values(RISKQUIZ.a); return Math.max(1,Math.min(5,Math.round(v.reduce((s,x)=>s+x,0)/v.length))); }
function renderQuizResult(){
  const mr=document.getElementById('modal-root'); if(!mr)return; const band=quizBand(); const s=QUIZ_STYLES[band-1];
  let shell=mr.querySelector('.rq-modal');
  if(!shell){
    mr.innerHTML = `<div class="modal-back"><div class="modal rq-modal" role="dialog" aria-modal="true" aria-label="Your investment style">
      <button class="mh-close" aria-label="Close" onclick="closeRiskQuiz()">✕</button><div class="rq-inner" id="rq-inner"></div></div></div>`;
    shell=mr.querySelector('.rq-modal');
  }
  shell.classList.add('rq-result');
  document.getElementById('rq-inner').innerHTML = `
    <div class="rq-progress">${RQ.map(()=>'<span class="rq-seg on"></span>').join('')}</div>
    <div class="rq-badge">${icon('shield')}</div>
    <div class="rq-tier">${s.tier}</div>
    <div class="rq-name">${s.name}</div>
    <div class="rq-desc">${s.desc}</div>
    <div class="rq-actions">
      <button class="btn btn-ghost" onclick="quizRetake()">Retake</button>
      <button class="btn btn-primary" onclick="applyRiskQuiz()">Use this investment style</button></div>`;
  const m=document.querySelector('.rq-modal'); if(m) m.scrollTop=0;
}
function quizRetake(){ if(!RISKQUIZ)return; RISKQUIZ.i=0; RISKQUIZ.a={}; renderRiskQuiz(); }
function closeRiskQuiz(){ RISKQUIZ=null; const mr=document.getElementById('modal-root'); if(mr) mr.innerHTML=''; }
function applyRiskQuiz(){
  if(!RISKQUIZ)return; const k=RISKQUIZ.k; const band=quizBand(); const s=QUIZ_STYLES[band-1];
  RISKQUIZ=null; const mr=document.getElementById('modal-root'); if(mr) mr.innerHTML='';
  ans(k).risk=band; ans(k).editRisk=true; save();
  toast('Investment style: '+s.tier+' · '+s.name);
  render();
}
function wealthSetupNext(k, overlay){
  const a=ans(k);
  const tEl=document.getElementById('w-target');
  if(tEl){ const t=parseFloat(tEl.value); if(!(t>0)){ toast('Enter a target amount'); shake('w-target'); return; } a.target=t; }
  else a.target=a.amt;
  const m=parseFloat((document.getElementById('w-monthly')||{}).value);
  if(!(m>0)){ toast('Enter a monthly contribution'); shake('w-monthly'); return; }
  a.monthly=m; save(); jGo(3);
}
function wealthPortfolioDone(k, overlay){
  const a=ans(k); const band=a.risk||3;
  a.portfolio=true; a.portfolioName=['Capital Preservation','Cautious','Balanced Growth','Growth','High Growth'][band-1];
  state.fed.yourWealth='plan';
  // Canonical plan so the Your-wealth card + Complete-your-setup reflect it no matter
  // which journey (Grow / Save / Retirement) produced it.
  state.plan={name:a.portfolioName, risk:band, shariah:!!a.shariah};
  // A brand-new plan has no saved balance yet, so we don't fake "On track / 34%".
  const started = state.linked;
  const prob = started ? 'On track' : 'Getting started';
  if(overlay==='save'||k==='save'){ const types=Array.isArray(a.goalType)?a.goalType.slice():(a.goalType?[a.goalType]:['Goal']); state.goal={type:types[0]||'Goal',types,target:a.target||a.amt||null,year:(a.when||'').slice(0,4)||null,monthly:a.monthly,probability:prob,started}; state.fed.aimingFor='goal'; }
  if(overlay==='retirement'||k==='retirement'){ state.goal={type:'Retirement',target:a.target||2000000,year:String(new Date().getFullYear()+ (a.retireAge? Math.max(1,a.retireAge-(state.age||35)):30)),monthly:a.monthly,probability:prob,started,projected:true}; state.fed.aimingFor='goal'; }
  track('portfolio_recommended',{risk_band:band, goal_type:a.objective||a.goalType||'retirement'});
  save(); journeyDone();
}

/* Fact sheet, opens in a right-hand drawer (RHS window) from the recommended-portfolio step */
function openFactSheet(k){
  if(document.getElementById('fs-overlay')) return;
  closeOtherOverlays();
  const a=ans(k); const band=a.risk||3;
  const name=['Capital Preservation','Cautious','Balanced Growth','Growth','High Growth'][band-1];
  const growth=band*15+10, defensive=100-growth;
  const term=band<=2?'1–3 yrs':band===3?'3–5 yrs':'5+ yrs';
  const ret=(5+band*1.5).toFixed(1);
  const rows=[['1 year','+'+(2+band*1.2).toFixed(1)+'%'],['3 years (p.a.)','+'+(4+band*1.3).toFixed(1)+'%'],['5 years (p.a.)','+'+ret+'%']];
  const holdings=[['Global equity index',growth-10+'%'],['Emerging-market equity','10%'],['Government &amp; corporate bonds',Math.max(0,defensive-10)+'%'],['Cash &amp; money market','10%']];
  const el=document.createElement('div'); el.id='fs-overlay';
  el.innerHTML=`
   <div class="rhs-scrim" onclick="closeFactSheet()"></div>
   <aside class="rhs-drawer" role="dialog" aria-label="Portfolio fact sheet">
     <div class="rhs-head">
       <div><div class="rhs-eyebrow">Fact sheet</div><div class="rhs-title">${name}${a.shariah?' · Shariah':''}</div></div>
       <button class="rhs-close" onclick="closeFactSheet()" aria-label="Close">✕</button>
     </div>
     <div class="rhs-body">
       <div class="fs-badges"><span class="vpill green">Risk ${band}/5</span><span class="vpill outline">${term}</span>${a.shariah?'<span class="vpill green">Shariah-compliant</span>':''}</div>
       <div class="fs-sec"><div class="fs-l">Objective</div><div class="fs-v">${a.objective||a.goalType||'Long-term growth'} · ${market().curName}</div></div>
       <div class="fs-sec"><div class="fs-l">Asset allocation</div>
         <div class="fs-alloc"><i class="growth" style="width:${growth}%"></i><i class="defensive" style="width:${defensive}%"></i></div>
         <div class="fs-alloc-key"><span><i class="growth"></i> Growth ${growth}%</span><span><i class="defensive"></i> Defensive ${defensive}%</span></div></div>
       <div class="fs-sec"><div class="fs-l">Top holdings</div>
         ${holdings.map(([l,v])=>`<div class="rowline"><span>${l}</span><span class="r-amt">${v}</span></div>`).join('')}</div>
       <div class="fs-sec"><div class="fs-l">Past returns (illustrative)</div>
         ${rows.map(([l,v])=>`<div class="rowline"><span>${l}</span><span class="r-amt" style="color:var(--v-green-700)">${v}</span></div>`).join('')}</div>
       <div class="fs-sec"><div class="fs-l">Indicative cost</div><div class="rowline"><span>All-in annual fee</span><span class="r-amt">0.65% p.a.</span></div></div>
       <div class="fs-note">Past performance is not a guarantee of future returns. The full fact sheet, holdings and disclosures are provided before you open an account.</div>
     </div>
   </aside>`;
  document.body.appendChild(el);
}
function closeFactSheet(){ const o=document.getElementById('fs-overlay'); if(o) o.remove(); }

/* legal links, honest non-dead response in the prototype */
function legalDoc(name){ toast(`${name} opens here in the full app.`); }
/* module entries that live post-onboarding, honest, non-dead response */
function moduleToast(name){ toast(`${name} opens in the full Absa app, this prototype focuses on onboarding and the adaptive dashboard.`); }
/* tiny toast */
function toast(msg){ let t=document.getElementById('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.style.cssText='position:fixed;bottom:52px;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;padding:11px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:80;box-shadow:var(--shadow-lg)'; document.body.appendChild(t);} t.textContent=msg; t.style.opacity='1'; clearTimeout(t._t); t._t=setTimeout(()=>t.style.opacity='0',2200); }

/* ============================================================================
   Overlay UX (stabilization): one overlay at a time, Escape + backdrop dismiss,
   focus into/trap/restore, and a Back-button trap that never leaves the app.
   ============================================================================ */
/* M2: any opener calls this first, so a new overlay always replaces the old one. */
function closeOtherOverlays(){
  const mr=document.getElementById('modal-root'); if(mr) mr.innerHTML='';
  if(typeof CONNECT!=='undefined') CONNECT=null;
  if(typeof RISKQUIZ!=='undefined') RISKQUIZ=null;
  if(typeof closeSettings==='function') closeSettings();
  if(typeof closeFactSheet==='function') closeFactSheet();
}
function overlayActive(){
  const mr=document.getElementById('modal-root');
  return !!(mr && mr.innerHTML.trim()) || !!document.getElementById('proto-overlay') || !!document.getElementById('fs-overlay');
}
function topOverlayEl(){
  return document.querySelector('#modal-root .modal') || document.querySelector('.rhs-drawer') || document.querySelector('.proto-drawer');
}
/* M1: close the top-most open overlay (used by Escape, backdrop click, Back). */
function dismissTopOverlay(){
  const mr=document.getElementById('modal-root');
  if(mr && mr.querySelector('.rq-modal')){ closeRiskQuiz(); return true; }
  if(mr && mr.querySelector('.meet-tara')){ if(typeof taraHandoff==='function') taraHandoff(); else mr.innerHTML=''; return true; }
  if(mr && mr.innerHTML.trim()){ if(typeof closeConnect==='function') closeConnect(); else mr.innerHTML=''; return true; }
  if(document.getElementById('fs-overlay')){ closeFactSheet(); return true; }
  if(document.getElementById('proto-overlay')){ closeSettings(); return true; }
  return false;
}
/* M2 gear-hide + M3 focus in/restore, driven by a single DOM observer. */
let LAST_TRIGGER=null, OV_WAS_OPEN=false;
function syncOverlay(){
  const active=overlayActive();
  document.body.classList.toggle('overlay-open', active);
  if(active && !OV_WAS_OPEN){
    LAST_TRIGGER=document.activeElement;
    const el=topOverlayEl();
    if(el){ const f=el.querySelector('.rq-opt') || el.querySelector('.btn-primary:not([disabled])') || el.querySelector('button:not([disabled]),a[href],input,select,textarea'); if(f&&f.focus) try{ f.focus(); }catch(e){} }
  } else if(!active && OV_WAS_OPEN){
    if(LAST_TRIGGER && LAST_TRIGGER.focus){ try{ LAST_TRIGGER.focus(); }catch(e){} }
    LAST_TRIGGER=null;
  }
  OV_WAS_OPEN=active;
}
window.addEventListener('DOMContentLoaded', ()=>{
  try{ history.pushState({v22:1}, ''); }catch(e){}   // H3: spare history entry so Back can never reach a blank page
  const mr=document.getElementById('modal-root');
  const mo=new MutationObserver(()=>syncOverlay());
  if(mr) mo.observe(mr, {childList:true, subtree:true});
  mo.observe(document.body, {childList:true});
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){ if(dismissTopOverlay()) e.preventDefault(); return; }
    if(e.key==='Tab' && overlayActive()){          // M3: trap Tab inside the open overlay
      const el=topOverlayEl(); if(!el) return;
      const f=[...el.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);
      if(!f.length) return;
      const first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      else if(!el.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('click', (e)=>{        // M1: click the dim backdrop to dismiss
    if(e.target && e.target.classList && e.target.classList.contains('modal-back')) dismissTopOverlay();
  });
});
window.addEventListener('popstate', ()=>{          // H3: keep Back inside the prototype
  try{ history.pushState({v22:1}, ''); }catch(e){}  // re-trap immediately
  if(dismissTopOverlay()) return;                   // Back first closes any open overlay
  if(typeof current!=='undefined' && current==='journey' && typeof jBack==='function'){ jBack(); return; }
  // otherwise remain on the current screen; never navigate away to a blank page
});

/* ---------------------------------------------------------------- boot */
window.addEventListener('DOMContentLoaded', ()=>{
  // Resume a mid-journey session on reload, so a refresh never loses the user's place.
  if(!state.onboardingComplete && state._resume && state._resume.key){
    JRUN={key:state._resume.key, step:state._resume.step||0, fromDash:!!state._resume.fromDash, picIndex:state._resume.picIndex||0};
    go('journey'); return;
  }
  go(state.onboardingComplete?'dashboard': (state.region? (state.name?'fork':'about') :'login'));
});

/* ===========================================================================
   ABSA SHELL BRIDGE
   This prototype is embedded in the Absa shell, whose single global Scenario
   drawer replaces this app's own gear FAB. The shell drives onboarding through
   the hooks below.

   FORCE_FAIL is a top-level `let`, i.e. a lexical binding, NOT a property of
   window, so the parent frame cannot assign it directly. setForceFail closes
   over it and is the only way in. Previously this was reachable only by typing
   FORCE_FAIL = '...' into the console, so the bank-link failure states were
   undemoable; the shell now exposes them as real toggles.
   =========================================================================== */
window.__absaOnb = {
  // bank-link failure injection: null = success, else a FAILURES key
  setForceFail(k){ FORCE_FAIL = k || null; },
  getForceFail(){ return FORCE_FAIL; },
  failures(){ return Object.keys(FAILURES).map(k => [k, FAILURES[k].t]); },
  // full-state demo presets
  demoA(){ loadDemoA(); },
  demoB(){ loadDemoB(); },
  reset(){ resetAll(); },
  // navigation
  screens(){ return [['login','Login'],['region','Region'],['about','About you'],['fork','The fork'],['dashboard','Dashboard']]; },
  goScreen(s){ go(s); },
  journeys(){ return INTENTS.map(i => [i.key, i.label]); },
  startJourney(k){ protoStartJourney(k); },
};
