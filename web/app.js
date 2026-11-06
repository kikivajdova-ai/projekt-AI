// Odpočívat spolu – webová aplikace. Bez frameworku: stav -> HTML -> obsluha kliknutí.
// Veškerý text od uživatelů (přezdívky, názvy skupin) prochází přes esc() kvůli bezpečnosti.
(() => {
'use strict';

const { createApi, CATEGORIES, CAT, PRESETS, levelPoints } = window.OS;
const api = createApi();
const root = document.getElementById('app');

// ---------- pomocné funkce ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => { const d = new Date(); d.setHours(d.getHours() - 4); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* nevadí */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nevadí */ } },
};
const moments = (n) => (n === 1 ? '1 chvilka' : n >= 2 && n <= 4 ? `${n} chvilky` : `${n} chvil`);

const ICON = {
  heart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23301A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  dots: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#23301A" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  plus: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  chevron: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#23301A" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  tab: {
    domu: (c) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
    pratele: (c) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" aria-hidden="true"><circle cx="9" cy="9" r="3.5"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 20c0-2 1-4 4-4"/></svg>`,
    zahrada: (c) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 21V11M12 11c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/></svg>`,
    ja: (c) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  },
};

function taskIcon(color) {
  return `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M14 25V13" stroke="#5F7424" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="10" cy="17" rx="4" ry="2.4" fill="#7E9240"/><circle cx="14" cy="10" r="5" fill="${color}"/></svg>`;
}

const GARDEN_SCENE = `<svg viewBox="0 0 390 280" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Ilustrace rozkvetlé zahrady">
  <circle cx="312" cy="92" r="26" fill="#F6E7A1"/><circle cx="312" cy="92" r="40" fill="#F6E7A1" opacity="0.35"/>
  <ellipse cx="92" cy="96" rx="30" ry="10" fill="#FFFFFF" opacity="0.8"/><ellipse cx="118" cy="88" rx="20" ry="9" fill="#FFFFFF" opacity="0.8"/>
  <path d="M246 132 q7 -9 14 0 q7 -9 14 0" fill="none" stroke="#23301A" stroke-width="2" stroke-linecap="round"/>
  <path d="M0 190 C70 156 140 162 200 180 C266 200 330 168 390 160 L390 280 L0 280 Z" fill="#C9D29C"/>
  <path d="M0 226 C80 204 166 208 244 222 C310 234 356 216 390 212 L390 280 L0 280 Z" fill="#A9B676"/>
  <path d="M78 222 V154" stroke="#5F7424" stroke-width="8" stroke-linecap="round"/>
  <circle cx="78" cy="132" r="34" fill="#6E8B2E"/><circle cx="52" cy="152" r="22" fill="#8FA34A"/><circle cx="104" cy="154" r="20" fill="#7E9240"/>
  <circle cx="68" cy="122" r="4.5" fill="#E8742A"/><circle cx="94" cy="140" r="4.5" fill="#E8742A"/>
  <path d="M168 240 V174" stroke="#5F7424" stroke-width="4" stroke-linecap="round"/><ellipse cx="156" cy="206" rx="11" ry="5.5" fill="#7E9240"/>
  <circle cx="168" cy="166" r="18" fill="#F2994A"/><circle cx="168" cy="166" r="8" fill="#8B6B4A"/>
  <path d="M218 244 V194 M229 244 V186 M240 244 V196" stroke="#5F7424" stroke-width="2.8" stroke-linecap="round"/>
  <ellipse cx="218" cy="189" rx="4.5" ry="10" fill="#B48ACB"/><ellipse cx="229" cy="180" rx="4.5" ry="11" fill="#9B8FD1"/><ellipse cx="240" cy="191" rx="4.5" ry="10" fill="#B48ACB"/>
  <path d="M292 248 V208" stroke="#5F7424" stroke-width="3" stroke-linecap="round"/><ellipse cx="303" cy="226" rx="10" ry="5" fill="#8FA34A"/>
  <circle cx="292" cy="201" r="12" fill="#FFFFFF"/><circle cx="292" cy="201" r="5" fill="#F2C94C"/>
  <path d="M346 252 V222" stroke="#5F7424" stroke-width="3" stroke-linecap="round"/><circle cx="346" cy="215" r="10" fill="#E8742A"/><circle cx="346" cy="215" r="4" fill="#FFF6D6"/>
  <circle cx="130" cy="250" r="6" fill="#F2C94C"/><circle cx="262" cy="258" r="5" fill="#FFFFFF"/><circle cx="30" cy="252" r="5" fill="#B48ACB"/><circle cx="372" cy="262" r="5" fill="#F2C94C"/>
</svg>`;

// ---------- stav aplikace ----------
const S = {
  phase: 'loading', // loading | auth | onboarding | app
  tab: 'domu',
  overlay: null, // nalada | sdileni | pozvanka
  authMode: 'login', authError: null, authInfo: null, busy: false,
  me: null, game: null, moments: [], custom: [], friends: [], feed: [], pings: [], invites: [], groups: [], groupInvites: [],
  mode: {}, friendFor: {}, sentInvite: {}, contribute: true,
  lastGrown: null, toast: null, menuFor: null, pinged: {}, inviteLink: null,
  inviteToken: null, invitePreview: null,
  mood: null, moodResult: null,
  shareFor: null, shareTarget: null, preview: null,
  confirmDelete: false, inviteAnswered: {},
  goalForm: false, goalCat: null, goalTarget: 10,
  weekly: null, weeklyForm: false, wCat: null, wTarget: 5,
};

function toast(msg) { S.toast = msg; render(); }
// Okénko „Skvělá práce!“ uprostřed obrazovky s rostoucí květinou.
function celebrate(title, cat, res, extra = '') {
  const c = CAT[cat] || CAT.JINE;
  const game = S.game?.hraZapnuta;
  let note = res?.zprava && res.zprava !== 'Chvilka pro tebe je zapsaná.' ? res.zprava : '';
  const level = S.game?.uroven || 1;
  const levelUp = game && S.levelSeen && level > S.levelSeen;
  // Nová úroveň = nová podoba zahrady (do 5. úrovně).
  if (levelUp && level <= GARDEN_LEVELS.length) note = `Nová úroveň ${level}! Tvoje zahrada se proměnila: ${gardenLevel(level).name}.`;
  else if (levelUp) note = `Nová úroveň ${level}!`;
  S.levelSeen = level;
  S.celebrate = {
    title,
    flower: c.flower,
    text: game ? 'Tvoje zahrada zase o kousek vyrostla.' : 'Chvilka pro tebe je zapsaná.',
    extra: [extra, note].filter(Boolean).join(' '),
  };
}

function celebrateView() {
  const c = S.celebrate;
  if (!c) return '';
  return `<div class="modal-layer">
    <div class="modal-backdrop" data-a="closeCelebrate"></div>
    <div class="modal${c === lastCelebrate ? ' static' : ''}" role="dialog" aria-modal="true" aria-labelledby="cel-title">
      <svg class="grow-flower" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <ellipse cx="60" cy="106" rx="34" ry="8" fill="#C9D29C"/>
        <path class="gf-stem" d="M60 104 C60 88 58 74 60 52" fill="none" stroke="#5F7424" stroke-width="5" stroke-linecap="round"/>
        <g class="gf-leaf gf-leaf-l"><ellipse cx="50" cy="86" rx="11" ry="5.5" fill="#7E9240" transform="rotate(-30 50 86)"/></g>
        <g class="gf-leaf gf-leaf-r"><ellipse cx="70" cy="74" rx="11" ry="5.5" fill="#8FA34A" transform="rotate(30 70 74)"/></g>
        <g class="gf-bloom">
          ${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="60" cy="34" rx="8" ry="14" fill="${esc(c.flower)}" transform="rotate(${a} 60 46)"/>`).join('')}
          <circle cx="60" cy="46" r="8" fill="#FFF6D6"/>
        </g>
        <g class="gf-spark" fill="#F2C94C"><circle cx="24" cy="30" r="3"/><circle cx="98" cy="24" r="2.5"/><circle cx="102" cy="60" r="3"/><circle cx="18" cy="64" r="2.5"/></g>
      </svg>
      <h2 id="cel-title">Skvělá práce!</h2>
      <p style="font-weight:600">${esc(c.title)}</p>
      <p class="green-text">${esc(c.text)}</p>
      ${c.extra ? `<p class="muted small">${esc(c.extra)}</p>` : ''}
      <button class="btn big" id="cel-ok" data-a="closeCelebrate">Pokračovat</button>
    </div>
  </div>`;
}


async function guard(fn) {
  if (S.busy) return;
  S.busy = true;
  try { await fn(); } catch (e) { S.toast = e.message || 'Něco se pokazilo.'; } finally { S.busy = false; render(); }
}

async function loadAll() {
  const [me, game, ms, friends, feed, pings, invites, groups, gi, custom, wg] = await Promise.all([
    api.me(), api.game(), api.moments(), api.friends(), api.feed(), api.pings(), api.restInvites(), api.groups(), api.groupInvitations(),
    api.customActivities(), api.weeklyGoal(),
  ]);
  Object.assign(S, { me, game, moments: ms, friends, feed, pings, invites, groups, groupInvites: gi, custom, weekly: wg?.cil || null });
}

async function boot() {
  readHash();
  const session = await api.session();
  if (!session) { S.phase = 'auth'; render(); return; }
  const me = await api.me();
  if (!me.profil) {
    const pending = store.get('os-pending-name');
    if (pending) {
      await api.createProfile(pending);
      await api.consent('PODMINKY', true);
      store.del('os-pending-name');
      return boot();
    }
    S.phase = 'onboarding'; render(); return;
  }
  await loadAll();
  S.gardenSeen = Object.values(S.game?.zahrada || {}).reduce((a, b) => a + b, 0);
  S.levelSeen = S.game?.uroven || 1;
  S.phase = 'app';
  if (S.inviteToken) {
    S.overlay = 'pozvanka';
    try { S.invitePreview = await api.previewInvite(S.inviteToken); } catch (e) { S.invitePreview = { error: e.message }; }
  }
  render();
}

function readHash() {
  const m = location.hash.match(/^#\/pozvanka\/([A-Za-z0-9_-]{10,100})$/);
  if (m) S.inviteToken = m[1];
}

// ---------- obrazovky ----------
function view() {
  const demo = api.demo ? `<div class="demo-banner">Ukázkový režim: data jsou jen v tomto prohlížeči. <button class="btn soft small-btn" style="min-height:28px;padding:0 10px;margin-left:6px" data-a="demoReset">Začít znovu</button></div>` : '';
  if (S.phase === 'loading') return `${demo}<div class="center"><p class="muted">Načítám…</p></div>`;
  if (S.phase === 'auth') return demo + authView();
  if (S.phase === 'onboarding') return demo + onboardingView() + toastView();
  if (S.overlay === 'nalada') return demo + moodView() + toastView();
  if (S.overlay === 'sdileni') return demo + shareView() + toastView();
  if (S.overlay === 'pozvanka') return demo + inviteAcceptView();
  const screens = { domu: homeView, pratele: friendsView, zahrada: gardenView, ja: meView };
  return demo + screens[S.tab]() + toastView() + tabbar() + celebrateView();
}

function authView() {
  const reg = S.authMode === 'register';
  return `<div class="screen" style="padding-bottom:28px">
    <div style="margin:-24px -20px 0;height:200px;position:relative;overflow:hidden;background:var(--tint)">${GARDEN_SCENE.replace('<svg ', '<svg style="position:absolute;inset:0;width:100%;height:100%" ')}</div>
    <h1>Odpočívat spolu</h1>
    <p class="muted">Odpočinek místo výkonu. Spolu s kamarády, bez tlaku a srovnávání.</p>
    <div class="seg" role="group" aria-label="Přihlášení nebo registrace">
      <button type="button" aria-pressed="${!reg}" data-a="authMode" data-v="login">Přihlásit se</button>
      <button type="button" aria-pressed="${reg}" data-a="authMode" data-v="register">Nový účet</button>
    </div>
    ${S.authError ? `<p class="error" role="alert">${esc(S.authError)}</p>` : ''}
    ${S.authInfo ? `<p class="card tint" style="padding:14px 16px" role="status">${esc(S.authInfo)}</p>` : ''}
    ${S.needsConfirm ? `<button class="btn ghost" type="button" data-a="resend">Poslat potvrzovací e-mail znovu</button>` : ''}
    <form data-form="auth" class="stack" novalidate>
      ${reg ? `<div class="field"><label for="f-name">Přezdívka (uvidí ji jen tvoji přátelé)</label><input id="f-name" name="name" maxlength="40" required autocomplete="nickname"></div>` : ''}
      <div class="field"><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="f-pass">Heslo${reg ? ' (aspoň 10 znaků)' : ''}</label><input id="f-pass" name="password" type="password" minlength="${reg ? 10 : 1}" required autocomplete="${reg ? 'new-password' : 'current-password'}"></div>
      ${reg ? `<label class="check"><input type="checkbox" name="terms" required> <span>Souhlasím s podmínkami a zásadami ochrany soukromí.</span></label>` : ''}
      <button class="btn big" type="submit" ${S.busy ? 'disabled' : ''}>${reg ? 'Vytvořit účet' : 'Přihlásit se'}</button>
      ${reg ? '' : '<button class="btn ghost" type="button" data-a="forgot">Zapomenuté heslo</button>'}
    </form>
  </div>`;
}

function onboardingView() {
  return `<div class="screen" style="padding-bottom:28px">
    <h1>Jak ti máme říkat?</h1>
    <p class="muted">Přezdívku uvidí jen kamarádi, které si sám/sama pozveš.</p>
    <form data-form="profile" class="stack">
      <div class="field"><label for="f-nick">Přezdívka</label><input id="f-nick" name="name" maxlength="40" required></div>
      <button class="btn big" type="submit">Pokračovat</button>
    </form>
  </div>`;
}

function myGoal() {
  // Přednost má cíl, který se ještě plní; splněný se ukáže, jen když jiný není.
  let reached = null;
  for (const g of S.groups) for (const c of g.cile || []) { if (!c.reached) return { group: g, goal: c }; reached ??= { group: g, goal: c }; }
  return reached;
}
function sentFor(cat) {
  const id = S.sentInvite[cat];
  return id ? S.invites.find((i) => i.id === id) || { id, prijato: false, waiting: true } : null;
}
function confirmedFriends() { return S.friends.filter((f) => f.stav === 'PRATELE'); }

function homeView() {
  const g = S.game || {};
  const goal = myGoal();
  const incoming = S.invites.find((i) => i.smer === 'PRICHOZI' && (i.muzesOdpovedet || S.inviteAnswered[i.id]));
  const name = S.me?.profil?.prezdivka || '';
  const goalCard = goal
    ? `<section class="card"><div class="row between"><div><p class="label">Společný cíl tohoto týdne</p><h2>${esc(goal.group.nazev)}</h2></div><span class="chip group">Skupina</span></div>
        <p style="font-size:15px">${esc(goal.goal.text)}</p>
        <div class="bar" role="img" aria-label="${esc(goal.goal.text)}"><span style="width:${Math.min(100, Math.round((100 * goal.goal.together) / goal.goal.target))}%"></span></div></section>`
    : weeklyCard();
  const inviteCard = incoming
    ? `<section class="card"><div><p class="label">${esc(incoming.kdo)} tě zve</p><h2 style="font-size:17px">${esc(CAT[incoming.kategorie]?.title || incoming.text)}: přidáš se?</h2></div>
        ${S.inviteAnswered[incoming.id]
          ? `<p class="small green-text" aria-live="polite">${S.inviteAnswered[incoming.id] === 'PRIDAM_SE' ? 'Super, užijte si to spolu. Až to bude, zapiš to jako společnou chvilku.' : 'V pohodě. Nic vysvětlovat nemusíš.'}</p>`
          : `<div class="btn-row"><button class="btn ghost" data-a="answerRest" data-id="${esc(incoming.id)}" data-v="TED_NE">Teď ne</button><button class="btn" data-a="answerRest" data-id="${esc(incoming.id)}" data-v="PRIDAM_SE">Přidám se</button></div>`}
      </section>`
    : '';
  const tasks = PRESETS.map((c) => taskCard(c, goal)).join('') + S.custom.map(customCard).join('') + customCreateCard();
  return `<div class="screen home">
    <header class="hero">
      <div class="hero-top">
        ${g.hraZapnuta ? `<button class="btn soft small-btn" style="background:#fff;color:var(--ink-green)" data-a="tab" data-v="zahrada">Úroveň ${esc(g.uroven)} · Zahrada</button>` : `<p class="label green-text">${new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>`}
      </div>
      <h1>Ahoj, ${esc(name)}</h1>
      <p class="green-text" style="font-size:16px">Jak si dnes odpočineš?</p>
    </header>
    <div class="home-body">
      ${goalCard}
      ${inviteCard}
      <div><h2 style="font-size:19px">Vyber si chvilku pro sebe</h2><p class="muted small">Sám, sama, nebo s někým. Každá splněná chvilka nechá něco vyrůst v zahradě. Chybí ti tu něco? Vytvoř si vlastní chvilku dole.</p></div>
      ${tasks}
    </div>
  </div>`;
}

function taskCard(c, goal) {
  const spolu = S.mode[c.id] === 'spolu';
  const friends = confirmedFriends();
  const friendId = S.friendFor[c.id] || friends[0]?.id;
  const friend = friends.find((f) => f.id === friendId);
  const sent = sentFor(c.id);
  const goalMatch = goal && goal.goal.category === c.id;
  let action;
  if (!spolu) action = `<button class="btn" data-a="complete" data-cat="${c.id}">Hotovo</button>`;
  else if (!friends.length) action = `<p class="small muted">Zatím nemáš kamarády. Pozvi je v záložce Přátelé.</p>`;
  else if (!sent) action = `<button class="btn" data-a="inviteFor" data-cat="${c.id}">Pozvat: ${esc(friend?.jmeno)}</button>`;
  else if (sent.prijato) action = `<button class="btn" data-a="complete" data-cat="${c.id}" data-joint="1">Splněno spolu s ${esc(friend?.jmeno)}</button>`;
  else action = `<p class="small green-text">Pozvánka odeslána: ${esc(friend?.jmeno)}. Odmítnout jde jedním klepnutím, bez vysvětlování.</p>
      <button class="btn ghost" data-a="complete" data-cat="${c.id}">Splnit i tak sám/sama</button>`;
  // Po splnění se karta vrátí do původní podoby, ať jde chvilku kdykoli zapsat znovu.
  return `<section class="card${S.justDone === c.id ? ' just-done' : ''}">
    <div class="row"><div class="task-icon">${taskIcon(c.flower)}</div><div class="grow"><h3>${c.title}</h3><p class="muted small">${c.hint}</p></div><span class="chip">${spolu ? 'Spolu' : 'Jen já'}</span></div>
    <div class="stack">
      <div class="seg" role="group" aria-label="S kým"><button type="button" aria-pressed="${!spolu}" data-a="mode" data-cat="${c.id}" data-v="sam">Sám / sama</button><button type="button" aria-pressed="${spolu}" data-a="mode" data-cat="${c.id}" data-v="spolu">S kamarádem</button></div>
      ${spolu && friends.length && !sent ? `<div class="pills"><span class="small muted">Pozvat:</span>${friends.map((f) => `<button type="button" class="pill" aria-pressed="${f.id === friendId}" data-a="pickFriend" data-cat="${c.id}" data-id="${esc(f.id)}">${esc(f.jmeno)}</button>`).join('')}</div>` : ''}
      ${goalMatch ? `<label class="check small"><input type="checkbox" data-a="contribute" ${S.contribute ? 'checked' : ''}> <span>Započítat do cíle skupiny ${esc(goal.group.nazev)} (skupina uvidí jen společný součet)</span></label>` : ''}
      ${action}
    </div>
  </section>`;
}

// Cíl tohoto týdne pro jednoho. Jakmile si s kamarády dáte společný cíl, ukáže se na jeho místě ten.
function weeklyCard() {
  const w = S.weekly;
  if (S.weeklyForm) {
    const cat = S.wCat || '';
    const noun = cat ? CAT[cat].gen : (S.wTarget === 1 ? 'chvilky' : 'chvilek');
    return `<section class="card"><p class="label">Cíl tohoto týdne</p><h2>Na co si dáš cíl?</h2>
      <div class="pills"><button type="button" class="pill" aria-pressed="${!cat}" data-a="wCat" data-v="">Jakákoli chvilka</button>${PRESETS.map((c) => `<button type="button" class="pill" aria-pressed="${c.id === cat}" data-a="wCat" data-v="${c.id}">${esc(c.title)}</button>`).join('')}</div>
      <p style="font-weight:600">Kolikrát za týden?</p>
      <div class="row stepper"><button type="button" class="icon-btn soft" aria-label="Méně" data-a="wTarget" data-v="-1">−</button>
        <span class="stepper-value" aria-live="polite">${S.wTarget}</span>
        <button type="button" class="icon-btn soft" aria-label="Více" data-a="wTarget" data-v="1">+</button>
        <span class="muted small grow">${esc(noun)} tento týden</span></div>
      <p class="muted small">Když se to nepovede, nic se neděje. Příští týden začneš s čistým štítem.</p>
      <div class="btn-row"><button class="btn ghost" data-a="weeklyCancel">Zrušit</button><button class="btn" data-a="weeklySave">Uložit cíl</button></div>
      ${w ? '<button class="btn ghost small-btn" data-a="weeklyDelete">Tento týden bez cíle</button>' : ''}
    </section>`;
  }
  if (w) {
    const pct = Math.min(100, Math.round((100 * w.hotovo) / w.cil));
    return `<section class="card"><div class="row between"><div><p class="label">Cíl tohoto týdne</p><h2>${esc(w.category ? CAT[w.category].title : 'Chvilky pro sebe')}</h2></div><span class="chip">Jen já</span></div>
      <p style="font-size:15px"${w.splneno ? ' class="green-text"' : ''}>${esc(w.text)}</p>
      <div class="bar" role="img" aria-label="${esc(w.text)}"><span style="width:${Math.max(pct, 3)}%"></span></div>
      <div class="row between"><button class="btn ghost small-btn" data-a="weeklyOpen">Upravit cíl</button><button class="btn ghost small-btn" data-a="goToGoal">Cíl s kamarády</button></div>
    </section>`;
  }
  return `<section class="card"><p class="label">Cíl tohoto týdne</p><h2>Dej si cíl na tento týden</h2>
    <p class="muted">Třeba 5 chvilek pro sebe nebo 3 procházky. Když se to nepovede, nic se neděje.</p>
    <button class="btn" data-a="weeklyOpen">Nastavit cíl</button>
    <button class="btn ghost small-btn" data-a="goToGoal">Nebo si dejte společný cíl s kamarády</button>
  </section>`;
}

// Vlastní chvilka: jen pro sebe (název vidí jen autor), splní se jedním klepnutím.
function customCard(c) {
  const j = CAT.JINE;
  return `<section class="card${S.justDone === c.id ? ' just-done' : ''}">
    <div class="row"><div class="task-icon">${taskIcon(j.flower)}</div><div class="grow"><h3>${esc(c.nazev)}</h3><p class="muted small">Tvoje vlastní chvilka</p></div><span class="chip">Jen já</span></div>
    <div class="btn-row"><button class="btn ghost" data-a="removeCustom" data-id="${esc(c.id)}" aria-label="Odebrat chvilku ${esc(c.nazev)}">Odebrat</button><button class="btn" data-a="completeCustom" data-id="${esc(c.id)}">Hotovo</button></div>
  </section>`;
}

function customCreateCard() {
  return `<section class="card tint">
    <div><h3>Vytvořit si vlastní chvilku</h3><p class="green-text small">Napiš, co ti dělá dobře, třeba „Koupel“ nebo „Hra s kočkou“. Název uvidíš jen ty.</p></div>
    <form data-form="custom" class="stack">
      <div class="field"><label for="f-custom">Název chvilky</label><input id="f-custom" name="title" maxlength="60" required placeholder="Např. Hrnek čaje v klidu"></div>
      <button class="btn" type="submit" ${S.busy ? 'disabled' : ''}>Vytvořit chvilku</button>
    </form>
  </section>`;
}

function friendsView() {
  const pending = S.friends.filter((f) => f.stav === 'CEKA_NA_TEBE');
  const waiting = S.friends.filter((f) => f.stav === 'CEKA_NA_NI_NEJ');
  const friends = confirmedFriends();
  const group = S.groups[0];
  return `<div class="screen">
    <div><h1>Přátelé</h1><p class="muted">Kamarády přidáš jen přes pozvánku. Nikoho cizího tu nenajdeš.</p></div>
    <section class="card tint">
      <div class="stack" style="gap:6px"><h2>Odpočívat spolu je víc</h2><p class="green-text small" style="line-height:1.5">Pošli kamarádovi osobní odkaz. Jakmile ho přijme, jste přátelé. Nic dalšího potvrzovat nemusíš.</p></div>
      ${S.inviteLink
        ? `<div class="field"><label for="f-link">Odkaz platí 3 dny a jen pro jednoho člověka</label><input id="f-link" readonly value="${esc(S.inviteLink)}"></div>
           <div class="btn-row"><button class="btn" data-a="copyLink">Zkopírovat</button>${navigator.share ? '<button class="btn ghost" data-a="shareLink">Poslat…</button>' : ''}</div>`
        : `<button class="btn big" data-a="createInvite">Pozvat kamaráda odkazem</button>`}
    </section>
    ${goalSection(group, friends)}
    ${pending.map((f) => `<section class="card"><div class="row"><div class="avatar">${esc(f.jmeno.charAt(0))}</div><div class="grow"><h3>${esc(f.jmeno)}</h3><p class="muted small">chce být tvůj kamarád/kamarádka</p></div></div>
      <div class="btn-row"><button class="btn ghost" data-a="removeFriend" data-id="${esc(f.id)}">Teď ne</button><button class="btn" data-a="confirmFriend" data-id="${esc(f.id)}">Potvrdit</button></div></section>`).join('')}
    ${S.groupInvites.map((g) => `<section class="card"><p class="label">${esc(g.odKoho)} tě zve do skupiny</p><h3>${esc(g.skupina)}</h3>
      <div class="btn-row"><button class="btn ghost" data-a="answerGroup" data-id="${esc(g.id)}" data-v="0">Teď ne</button><button class="btn" data-a="answerGroup" data-id="${esc(g.id)}" data-v="1">Přidat se</button></div></section>`).join('')}
    ${S.pings.slice(0, 3).map((p) => `<section class="card"><div class="row"><div class="avatar warm">${esc(p.odKoho.charAt(0))}</div><div class="grow"><h3>${esc(p.odKoho)} ti poslal(a) povzbuzení</h3><p class="muted small">„${esc(p.text)}“ Nemusíš odpovídat.</p></div></div></section>`).join('')}
    <h2 style="margin-top:6px">Povzbudit jedním klepnutím</h2>
    ${friends.length ? '' : '<p class="muted">Až budeš mít kamarády, uvidíš je tady.</p>'}
    ${friends.map((f) => `<section class="card">
      <div class="row"><div class="avatar">${esc(f.jmeno.charAt(0))}</div><h3 class="grow">${esc(f.jmeno)}</h3>
        <button class="icon-btn soft" aria-label="Možnosti pro ${esc(f.jmeno)}" aria-expanded="${S.menuFor === f.id}" data-a="menu" data-id="${esc(f.id)}">${ICON.dots}</button></div>
      ${S.pinged[f.id]
        ? `<p class="small green-text" style="font-weight:600">Odesláno. ${esc(f.jmeno)} ví, že na něj/ni myslíš.</p>`
        : `<div class="btn-row"><button class="btn ghost small-btn" data-a="ping" data-id="${esc(f.id)}" data-v="MYSLIM_NA_TEBE">Myslím na tebe</button><button class="btn ghost small-btn" data-a="ping" data-id="${esc(f.id)}" data-v="DEJ_SI_PAUZU">Dej si pauzu</button></div>`}
      ${S.menuFor === f.id ? `<div class="stack">
        ${group && !api.demo ? `<button class="btn soft small-btn" data-a="inviteToGroup" data-id="${esc(f.id)}">Pozvat do skupiny ${esc(group.nazev)}</button>` : ''}
        <div class="btn-row"><button class="btn soft small-btn" data-a="block" data-id="${esc(f.id)}">Zablokovat</button><button class="btn soft small-btn" data-a="report" data-id="${esc(f.id)}">Nahlásit</button></div>
        <button class="btn soft small-btn" data-a="removeFriend" data-id="${esc(f.id)}">Odebrat z přátel</button></div>` : ''}
    </section>`).join('')}
    ${waiting.length ? `<p class="muted small">Čeká na potvrzení: ${waiting.map((w) => esc(w.jmeno)).join(', ')}</p>` : ''}
    <h2 style="margin-top:6px">Co se kamarádům podařilo</h2>
    <p class="muted small" style="margin-top:-8px">Jen splněné chvíle, které kamarádi sami sdíleli.</p>
    ${S.feed.length ? S.feed.map((e) => `<div class="feed-item"><p><b>${esc(e.authorName)}</b> · ${esc(e.label)}</p><span class="small muted">${e.day === todayStr() ? 'dnes' : esc(new Date(e.day + 'T12:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }))}</span></div>`).join('') : '<p class="muted">Zatím tu nic není.</p>'}
  </div>`;
}

// Společný cíl tohoto týdne: založit skupinu, přidat cíl a plnit ho. Jen společný součet, nic po lidech.
function goalSection(group, friends) {
  if (!group) {
    return `<section class="card" id="cil"><p class="label">Společný cíl tohoto týdne</p><h2>Založte si skupinu</h2>
      <p class="muted small">Skupina je pro pár kamarádů (nejvýš 8). Dáte si společný cíl na týden a uvidíte jen, kolik jste dali dohromady. Žádné pořadí.</p>
      <form data-form="group" class="stack">
        <div class="field"><label for="f-group">Název skupiny</label><input id="f-group" name="name" maxlength="40" value="Chill crew" required></div>
        <button class="btn" type="submit" ${S.busy ? 'disabled' : ''}>Založit skupinu</button>
      </form></section>`;
  }
  const allGoals = group.cile || [];
  // Splněný cíl ze seznamu zmizí (druh odpočinku zůstává na tento týden obsazený).
  const goals = allGoals.filter((g) => !g.reached);
  const reachedCount = allGoals.length - goals.length;
  const used = new Set(allGoals.map((g) => g.category));
  const free = PRESETS.filter((c) => !used.has(c.id));
  const cat = S.goalCat && !used.has(S.goalCat) ? S.goalCat : free[0]?.id;
  const memberIds = new Set((group.clenove || []).map((m) => m.id));
  const invitable = friends.filter((f) => !memberIds.has(f.id));
  const goalCard = (g) => {
    const c = CAT[g.category] || {};
    const pct = Math.min(100, Math.round((100 * g.together) / g.target));
    return `<div class="stack goal-item" style="gap:10px">
      <div class="row"><div class="task-icon">${taskIcon(c.flower)}</div><div class="grow"><h3>${esc(c.title || g.category)}</h3><p class="small${g.reached ? ' green-text' : ' muted'}" style="font-weight:600">${esc(g.text)}</p></div></div>
      <div class="bar" role="img" aria-label="${esc(g.text)}"><span style="width:${Math.max(pct, 3)}%"></span></div>
      <button class="btn${g.reached ? ' ghost' : ''}" data-a="goalDo" data-id="${esc(g.goalId)}" data-cat="${esc(g.category)}">${g.reached ? 'Přidat další chvilku' : 'Splnit chvilku do cíle'}</button>
    </div>`;
  };
  const form = S.goalForm && free.length
    ? `<div class="stack goal-form">
        <p style="font-weight:600">Na čem si dáte cíl?</p>
        <div class="pills">${free.map((c) => `<button type="button" class="pill" aria-pressed="${c.id === cat}" data-a="goalCat" data-v="${c.id}">${esc(c.title)}</button>`).join('')}</div>
        <p style="font-weight:600">Kolik chvilek spolu za týden?</p>
        <div class="row stepper"><button type="button" class="icon-btn soft" aria-label="Méně" data-a="goalTarget" data-v="-1">−</button>
          <span class="stepper-value" aria-live="polite">${S.goalTarget}</span>
          <button type="button" class="icon-btn soft" aria-label="Více" data-a="goalTarget" data-v="1">+</button>
          <span class="muted small grow">${esc(CAT[cat]?.gen || '')} dohromady</span></div>
        <div class="btn-row"><button class="btn ghost" data-a="goalCancel">Zrušit</button><button class="btn" data-a="goalCreate" data-v="${cat}">Přidat cíl</button></div>
      </div>`
    : free.length ? `<button class="btn ghost" data-a="goalOpen">+ Přidat cíl na tento týden</button>` : '';
  return `<section class="card" id="cil">
    <div class="row between"><div><p class="label">Společný cíl tohoto týdne</p><h2>${esc(group.nazev)}</h2></div><span class="chip group">Skupina</span></div>
    <p class="muted small">Ve skupině: ${(group.clenove || []).map((m) => esc(m.jmeno)).join(', ')}. Vidíte jen společný součet.</p>
    ${reachedCount ? `<p class="small green-text" style="font-weight:600">Tento týden jste spolu splnili ${reachedCount === 1 ? '1 cíl' : reachedCount < 5 ? `${reachedCount} cíle` : `${reachedCount} cílů`}. Skvělé!</p>` : ''}
    ${goals.length ? goals.map(goalCard).join('') : (S.goalForm || reachedCount ? '' : '<p class="muted">Tento týden zatím nemáte žádný cíl. Klidně si ho dejte, nebo jen tak odpočívejte.</p>')}
    ${form}
    ${invitable.length && !api.demo ? `<div class="pills"><span class="small muted">Pozvat do skupiny:</span>${invitable.map((f) => `<button type="button" class="pill" data-a="inviteToGroup" data-id="${esc(f.id)}">${esc(f.jmeno)}</button>`).join('')}</div>` : ''}
  </section>`;
}

// ---------- jedna velká zahrada ----------
// Začíná jen krajinou (nebe, slunce, kopce). Každá splněná chvilka posune růst o krok:
// rostliny přibývají jedna po druhé a každá má 3 fáze (klíček -> poupě -> květ).
// Nic nevadne a nic se neubírá; počítá se jen to, co se podařilo.
const GARDEN_PLANTS = [
  { kind: 'daisy', x: 292, y: 248, color: '#FFFFFF' },
  { kind: 'sunflower', x: 168, y: 240, color: '#F2994A' },
  { kind: 'lavender', x: 229, y: 244, color: '#B48ACB' },
  { kind: 'tulip', x: 346, y: 252, color: '#E8742A' },
  { kind: 'tree', x: 78, y: 222, color: '#E8742A' },
  { kind: 'dot', x: 130, y: 250, color: '#F2C94C' },
  { kind: 'daisy', x: 120, y: 262, color: '#FFFFFF' },
  { kind: 'dot', x: 30, y: 252, color: '#B48ACB' },
  { kind: 'tulip', x: 200, y: 262, color: '#F2C94C' },
  { kind: 'dot', x: 262, y: 258, color: '#FFFFFF' },
  { kind: 'lavender', x: 318, y: 262, color: '#9B8FD1' },
  { kind: 'dot', x: 372, y: 262, color: '#F2C94C' },
  { kind: 'sunflower', x: 24, y: 268, color: '#F2C94C' },
  { kind: 'daisy', x: 150, y: 270, color: '#F6E7A1' },
];
const GARDEN_STEPS = GARDEN_PLANTS.length * 3;

function sprout(x, y) {
  return `<path d="M${x} ${y} V${y - 12}" stroke="#5F7424" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="${x - 5}" cy="${y - 10}" rx="5" ry="2.6" fill="#8FA34A" transform="rotate(-25 ${x - 5} ${y - 10})"/>
    <ellipse cx="${x + 5}" cy="${y - 12}" rx="5" ry="2.6" fill="#7E9240" transform="rotate(25 ${x + 5} ${y - 12})"/>`;
}

function gardenPlant(p, stage) {
  const { x, y, color } = p;
  if (stage === 1) return sprout(x, y);
  const bud = stage === 2;
  switch (p.kind) {
    case 'tree': {
      if (bud) return `<path d="M${x} ${y} V${y - 40}" stroke="#5F7424" stroke-width="5" stroke-linecap="round"/>
        <circle cx="${x}" cy="${y - 50}" r="20" fill="#7E9240"/><circle cx="${x - 14}" cy="${y - 40}" r="11" fill="#8FA34A"/>`;
      return `<path d="M${x} ${y} V${y - 68}" stroke="#5F7424" stroke-width="8" stroke-linecap="round"/>
        <circle cx="${x}" cy="${y - 90}" r="34" fill="#6E8B2E"/><circle cx="${x - 26}" cy="${y - 70}" r="22" fill="#8FA34A"/><circle cx="${x + 26}" cy="${y - 68}" r="20" fill="#7E9240"/>
        <circle cx="${x - 10}" cy="${y - 100}" r="4.5" fill="${color}"/><circle cx="${x + 16}" cy="${y - 82}" r="4.5" fill="${color}"/><circle cx="${x - 22}" cy="${y - 66}" r="4" fill="${color}"/>`;
    }
    case 'sunflower': {
      const top = y - (bud ? 40 : 66);
      return `<path d="M${x} ${y} V${top}" stroke="#5F7424" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="${x - 12}" cy="${y - 28}" rx="11" ry="5.5" fill="#7E9240"/>
        ${bud ? `<circle cx="${x}" cy="${top}" r="7" fill="#8FA34A"/><circle cx="${x}" cy="${top - 2}" r="4" fill="${color}"/>`
          : `<circle cx="${x}" cy="${top}" r="18" fill="${color}"/><circle cx="${x}" cy="${top}" r="8" fill="#8B6B4A"/>`}`;
    }
    case 'lavender': {
      const h = bud ? 0.6 : 1;
      return [-11, 0, 11].map((dx, i) => {
        const top = y - (50 + (i === 1 ? 8 : 0)) * h;
        return `<path d="M${x + dx} ${y} V${top}" stroke="#5F7424" stroke-width="2.8" stroke-linecap="round"/>
          <ellipse cx="${x + dx}" cy="${top - 4}" rx="${bud ? 3 : 4.5}" ry="${bud ? 6 : 10}" fill="${bud ? '#C9B7DA' : color}"/>`;
      }).join('');
    }
    case 'tulip': {
      const top = y - (bud ? 22 : 32);
      return `<path d="M${x} ${y} V${top}" stroke="#5F7424" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="${x + 9}" cy="${y - 14}" rx="9" ry="4.5" fill="#8FA34A"/>
        ${bud ? `<ellipse cx="${x}" cy="${top - 4}" rx="4.5" ry="7" fill="${color}" opacity="0.8"/>`
          : `<path d="M${x - 10} ${top} Q${x - 10} ${top - 16} ${x - 5} ${top - 14} L${x} ${top - 8} L${x + 5} ${top - 14} Q${x + 10} ${top - 16} ${x + 10} ${top} Q${x} ${top + 9} ${x - 10} ${top}Z" fill="${color}"/>`}`;
    }
    case 'dot': {
      return `<path d="M${x} ${y} V${y - 10}" stroke="#5F7424" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="${x}" cy="${y - 13}" r="${bud ? 3.5 : 6}" fill="${color}"/>${bud ? '' : `<circle cx="${x}" cy="${y - 13}" r="2" fill="#FFF6D6"/>`}`;
    }
    default: { // daisy
      const top = y - (bud ? 26 : 40);
      return `<path d="M${x} ${y} V${top}" stroke="#5F7424" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="${x + 10}" cy="${y - 18}" rx="9" ry="4.5" fill="#8FA34A"/>
        ${bud ? `<circle cx="${x}" cy="${top}" r="5" fill="#8FA34A"/><circle cx="${x}" cy="${top - 1}" r="3" fill="${color}"/>`
          : `<circle cx="${x}" cy="${top}" r="12" fill="${color}" stroke="#E4E7D6" stroke-width="1"/><circle cx="${x}" cy="${top}" r="5" fill="#F2C94C"/>`}`;
    }
  }
}

// Pseudonáhodné, ale vždy stejné rozmístění (zahrada nepřeskakuje při každém otevření).
function seeded(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
const EXTRA_COLORS = ['#F2C94C', '#FFFFFF', '#B48ACB', '#E8742A', '#9B8FD1', '#F6E7A1', '#F2994A'];
const EXTRA_KINDS = ['dot', 'daisy', 'dot', 'tulip', 'dot', 'lavender'];
const MAX_EXTRAS = 240;

/** Co přesně vyrostlo za `total` splněných chvilek. Každá chvilka = jedna viditelná změna. */
function gardenItems(total) {
  const items = [];
  const base = Math.min(total, GARDEN_STEPS);
  GARDEN_PLANTS.forEach((p, i) => {
    const stage = Math.max(0, Math.min(3, base - i * 3));
    if (stage) items.push({ p, i, stage });
  });
  // Po rozkvetlé zahradě dál přibývají kvítky (každá chvilka jeden), občas i motýl.
  const extras = Math.min(Math.max(0, total - GARDEN_STEPS), MAX_EXTRAS);
  for (let k = 0; k < extras; k++) {
    const p = {
      kind: EXTRA_KINDS[k % EXTRA_KINDS.length],
      x: Math.round(12 + seeded(k + 1) * 366),
      y: Math.round(246 + seeded(k + 101) * 72),
      color: EXTRA_COLORS[k % EXTRA_COLORS.length],
    };
    items.push({ p, i: GARDEN_PLANTS.length + k, stage: 3, small: true });
  }
  return { items, butterflies: total >= GARDEN_STEPS ? 1 + Math.min(5, Math.floor(extras / 12)) : 0 };
}

// Každá úroveň má vlastní podobu zahrady. Rostliny zůstávají a rostou dál, mění se kulisa.
// Souřadnice: celé SVG 390×760; krajina (back/front) je ve skupině posunuté o 360 dolů.
const cloud = (x, y, k = 1, o = 0.85) => `<ellipse cx="${x}" cy="${y}" rx="${34 * k}" ry="${11 * k}" fill="#FFFFFF" opacity="${o}"/><ellipse cx="${x + 30 * k}" cy="${y - 9 * k}" rx="${22 * k}" ry="${10 * k}" fill="#FFFFFF" opacity="${o}"/>`;
const birds = '<path d="M240 400 q7 -9 14 0 q7 -9 14 0 M272 380 q5 -6 10 0 q5 -6 10 0" fill="none" stroke="#23301A" stroke-width="2" stroke-linecap="round"/>';
const appleTree = (x, y, k) => `<path d="M${x} ${y} V${y - 30 * k}" stroke="#7A5A3C" stroke-width="${5 * k}" stroke-linecap="round"/><circle cx="${x}" cy="${y - 42 * k}" r="${20 * k}" fill="#7E9240"/><circle cx="${x - 7 * k}" cy="${y - 46 * k}" r="${3 * k}" fill="#D9534F"/><circle cx="${x + 8 * k}" cy="${y - 38 * k}" r="${3 * k}" fill="#D9534F"/><circle cx="${x + 2 * k}" cy="${y - 52 * k}" r="${3 * k}" fill="#D9534F"/>`;

const GARDEN_LEVELS = [
  {
    name: 'Jarní louka',
    sky: ['#F4F1DE', '#E9EDD3'], hills: ['#C9D29C', '#A9B676', '#9AAA66'],
    sky2: (t) => `<circle cx="312" cy="300" r="30" fill="#F6E7A1"/><circle cx="312" cy="300" r="48" fill="#F6E7A1" opacity="0.35"/>${cloud(92, 300)}${cloud(206, 252, 0.7, 0.7)}${t >= 20 ? birds : ''}`,
    back: () => '', front: () => '',
  },
  {
    name: 'Zahrada u rybníčku',
    sky: ['#E4F0F2', '#E6EED6'], hills: ['#C2D39A', '#A3B873', '#93A964'],
    sky2: (t) => `<circle cx="70" cy="290" r="28" fill="#F8EBA8"/><circle cx="70" cy="290" r="44" fill="#F8EBA8" opacity="0.35"/>${cloud(200, 280)}${cloud(300, 330, 0.8)}${t >= 20 ? birds : ''}`,
    back: () => `<ellipse cx="205" cy="206" rx="78" ry="15" fill="#8FC1C8"/><ellipse cx="205" cy="203" rx="66" ry="10" fill="#A9D3D8"/>
      <ellipse cx="175" cy="205" rx="9" ry="3.5" fill="#6E8B2E"/><circle cx="178" cy="203" r="2.6" fill="#F6B8C8"/><ellipse cx="232" cy="208" rx="8" ry="3" fill="#7E9240"/>
      <g><ellipse cx="208" cy="201" rx="8" ry="5" fill="#FFFFFF"/><circle cx="214" cy="195" r="4" fill="#FFFFFF"/><path d="M217 195 l4 1 -4 1z" fill="#F2994A"/></g>
      <path d="M128 210 V186 M133 210 V190 M282 212 V188 M287 212 V192" stroke="#6E8B2E" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="128" cy="184" rx="2.4" ry="6" fill="#8B6B4A"/><ellipse cx="282" cy="186" rx="2.4" ry="6" fill="#8B6B4A"/>`,
    front: () => '',
  },
  {
    name: 'Ovocný sad',
    sky: ['#F8EED8', '#EDE9CF'], hills: ['#CBD09A', '#ADB673', '#9EA864'],
    sky2: (t) => `<circle cx="300" cy="320" r="30" fill="#F6D98B"/><circle cx="300" cy="320" r="48" fill="#F6D98B" opacity="0.3"/>${cloud(70, 270)}${t >= 20 ? birds : ''}`,
    back: () => `${appleTree(140, 182, 0.9)}${appleTree(262, 196, 0.8)}${appleTree(350, 172, 0.95)}
      <g stroke="#A27C56" stroke-width="3" stroke-linecap="round"><path d="M0 214 L390 206"/><path d="M0 226 L390 218"/>
      ${Array.from({ length: 14 }, (_, i) => `<path d="M${8 + i * 29} ${222 - i * 0.6} V${206 - i * 0.6}"/>`).join('')}</g>
      <g><rect x="296" y="196" width="44" height="6" rx="2" fill="#B88B5E"/><rect x="298" y="186" width="40" height="5" rx="2" fill="#B88B5E"/><path d="M300 202 V212 M336 202 V212" stroke="#8A6544" stroke-width="3"/></g>`,
    front: () => '',
  },
  {
    name: 'Večerní zahrada',
    sky: ['#F3C6A5', '#E8D3C8'], hills: ['#AFBE8A', '#8FA06A', '#7F925C'], dusk: true,
    sky2: () => `<circle cx="250" cy="520" r="36" fill="#F7A86B" opacity="0.9"/><circle cx="250" cy="520" r="60" fill="#F7A86B" opacity="0.25"/>
      <path d="M312 250 a20 20 0 1 0 14 32 a16 16 0 1 1 -14 -32z" fill="#FFF3D6"/>
      ${[[40, 230], [150, 210], [250, 280], [360, 230], [200, 330]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#FFF6D6"/>`).join('')}
      <path d="M0 410 Q100 450 195 420 T390 410" fill="none" stroke="#5C4A3A" stroke-width="1.5"/>
      ${[40, 95, 150, 205, 260, 315, 365].map((x, i) => { const y = [420, 434, 438, 423, 425, 430, 416][i]; return `<path d="M${x} ${y} V${y + 6}" stroke="#5C4A3A" stroke-width="1.2"/><circle cx="${x}" cy="${y + 12}" r="6" fill="#F6C65B"/><circle cx="${x}" cy="${y + 12}" r="11" fill="#F6C65B" opacity="0.3"/>`; }).join('')}`,
    back: () => '',
    front: () => `<g class="fireflies">${[[60, 150], [120, 120], [210, 140], [300, 110], [350, 160], [180, 100], [30, 190], [260, 180]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#FFF1A8"/><circle cx="${x}" cy="${y}" r="6" fill="#FFF1A8" opacity="0.3"/>`).join('')}</g>`,
  },
  {
    name: 'Kouzelná zahrada',
    sky: ['#EAF1F6', '#EEF0DA'], hills: ['#C6D69C', '#A5BD74', '#95AE66'],
    sky2: (t) => `<g opacity="0.75" fill="none" stroke-width="7">${['#E8742A', '#F2C94C', '#8FA34A', '#7FB7C9', '#9B8FD1'].map((c, i) => `<path d="M${20 + i * 7} 560 A${175 - i * 7} ${175 - i * 7} 0 0 1 ${370 - i * 7} 560" stroke="${c}"/>`).join('')}</g>
      <circle cx="330" cy="260" r="24" fill="#F6E7A1"/>${cloud(40, 300, 0.9)}${cloud(250, 250, 0.7, 0.7)}${t >= 20 ? birds : ''}`,
    back: () => `<g><rect x="296" y="148" width="58" height="40" rx="3" fill="#F4E9D8"/><path d="M290 150 L325 122 L360 150 Z" fill="#C46A4A"/>
      <rect x="318" y="164" width="14" height="24" rx="2" fill="#8A6544"/><rect x="301" y="158" width="11" height="11" rx="2" fill="#A9D3D8"/><rect x="338" y="158" width="11" height="11" rx="2" fill="#A9D3D8"/>
      <rect x="341" y="124" width="7" height="16" fill="#A0584A"/><circle cx="346" cy="114" r="5" fill="#FFFFFF" opacity="0.7"/><circle cx="352" cy="104" r="6.5" fill="#FFFFFF" opacity="0.55"/></g>
      ${[[325, 196, 9], [312, 210, 10], [296, 226, 11], [276, 244, 12]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.42}" fill="#D9D3C2"/>`).join('')}`,
    front: () => '',
  },
];

function gardenLevel(level) { return GARDEN_LEVELS[Math.max(0, Math.min(GARDEN_LEVELS.length, level || 1) - 1)]; }

function gardenScene(total, grewIndex, level = 1) {
  const L = gardenLevel(level);
  const { items, butterflies } = gardenItems(total);
  items.sort((a, b) => a.p.y - b.p.y);
  const label = `${L.name}. ${items.length ? `${items.length} ${items.length === 1 ? 'rostlina' : items.length < 5 ? 'rostliny' : 'rostlin'}` : 'Zatím jen krajina, první chvilka zasadí semínko'}`;
  return `<svg class="big-garden${L.dusk ? ' dusk' : ''}" viewBox="0 0 390 760" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Tvoje zahrada: ${label}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.sky[0]}"/><stop offset="0.7" stop-color="${L.sky[1]}"/></linearGradient></defs>
    <rect width="390" height="760" fill="url(#sky)"/>
    ${L.sky2(total)}
    <g transform="translate(0 360)">
      <path d="M0 190 C70 156 140 162 200 180 C266 200 330 168 390 160 L390 400 L0 400 Z" fill="${L.hills[0]}"/>
      ${L.back(total)}
      <path d="M0 226 C80 204 166 208 244 222 C310 234 356 216 390 212 L390 400 L0 400 Z" fill="${L.hills[1]}"/>
      <path d="M0 300 C90 286 200 292 280 300 C330 305 370 298 390 296 L390 400 L0 400 Z" fill="${L.hills[2]}" opacity="0.55"/>
      ${items.map(({ p, i, stage, small }) => {
        const plant = `<g class="gp${i === grewIndex ? ' grew' : ''}" style="transform-origin:${p.x}px ${p.y}px">${gardenPlant(p, stage)}</g>`;
        return small ? `<g transform="translate(${p.x} ${p.y}) scale(0.7) translate(${-p.x} ${-p.y})">${plant}</g>` : plant;
      }).join('')}
      ${L.front(total)}
    </g>
    ${Array.from({ length: butterflies }, (_, b) => { const x = 60 + seeded(b + 500) * 270; const y = 420 + seeded(b + 700) * 120; const c = EXTRA_COLORS[(b + 2) % EXTRA_COLORS.length];
      return `<g class="butterfly" style="animation-delay:${(b * 0.7).toFixed(1)}s"><ellipse cx="${x}" cy="${y}" rx="7" ry="5" fill="${c === '#FFFFFF' ? '#B48ACB' : c}" transform="rotate(-20 ${x} ${y})"/><ellipse cx="${x + 10}" cy="${y}" rx="7" ry="5" fill="#9B8FD1" transform="rotate(20 ${x + 10} ${y})"/><path d="M${x + 5} ${y - 5} V${y + 6}" stroke="#23301A" stroke-width="1.6" stroke-linecap="round"/></g>`; }).join('')}
  </svg>`;
}

function gardenView() {
  const g = S.game || {};
  if (!g.hraZapnuta) {
    return `<div class="screen"><div><h1>Tvoje zahrada</h1></div><section class="card"><p class="green-text">Herní prvky máš vypnuté. Zahrada na tebe počká přesně tak, jak je.</p></section></div>`;
  }
  const lo = levelPoints(g.uroven);
  const pct = Math.max(4, Math.round((100 * (g.body - lo)) / (g.dalsiUrovenPri - lo)));
  const total = Object.values(g.zahrada || {}).reduce((a, b) => a + b, 0);
  // Co právě vyrostlo (animuje se jen jednou, při prvním zobrazení po splnění).
  let grew = -1;
  if (S.gardenSeen != null && total > S.gardenSeen && total - GARDEN_STEPS <= MAX_EXTRAS) {
    grew = total <= GARDEN_STEPS ? Math.floor((total - 1) / 3) : GARDEN_PLANTS.length + (total - GARDEN_STEPS - 1);
  }
  S.gardenSeen = total;
  return `<div class="screen garden-screen">
    <div class="garden-bg">${gardenScene(total, grew, g.uroven)}</div>
    <div class="garden-head">
      <h1>Moje zahrada</h1>
      <section class="card glass"><div class="row between"><div><h2>Úroveň ${esc(g.uroven)}</h2><p class="green-text small" style="font-weight:600">${esc(gardenLevel(g.uroven).name)}</p></div><p class="muted small">Tento týden ${moments(g.chvilekTentoTyden || 0)}</p></div>
        <div class="bar" role="img" aria-label="Cesta k další úrovni: ${pct} %"><span style="width:${pct}%"></span></div></section>
    </div>
  </div>`;
}

function meView() {
  const st = S.me?.nastaveni || {};
  const g = S.game || {};
  const toggle = (key, label, hint) => `<div class="setting"><div class="grow"><p style="font-weight:600">${label}</p><p class="muted small">${hint}</p></div>
    <button type="button" class="switch" role="switch" aria-checked="${!!st[key]}" aria-label="${label}" data-a="setting" data-v="${key}"><span></span></button></div>`;
  const recent = S.moments.filter((m) => m.status === 'SPLNENO').slice(0, 6);
  const name = S.me?.profil?.prezdivka || '';
  return `<div class="screen">
    <div class="row"><div class="avatar" style="width:56px;height:56px;font-size:22px">${esc(name.charAt(0))}</div><div><h1 style="font-size:24px">${esc(name)}</h1><p class="muted small">Přezdívku vidí jen tvoji přátelé.</p></div></div>
    <button class="card" style="text-align:left;border:none;cursor:pointer;flex-direction:row;align-items:center;justify-content:space-between" data-a="openMood">
      <span><b>Jak se dnes mám?</b><br><span class="muted small">Záznam nálady vidíš jen ty</span></span>${ICON.chevron}</button>
    <section class="card" style="padding:6px 18px;gap:0">
      ${toggle('gameEnabled', 'Herní prvky', 'Zahrada a úrovně. Vypnutí ostatní nevidí.')}
      ${toggle('quietHoursEnabled', `Noční klid ${esc(st.quietStart || '22:00')}–${esc(st.quietEnd || '08:00')}`, 'V noci žádné notifikace')}
      ${toggle('receivePings', 'Přijímat povzbuzení', 'Když vypneš, odesílatel se to nedozví')}
      ${toggle('receiveRestInvites', 'Přijímat pozvánky k odpočinku', 'Když vypneš, odesílatel se to nedozví')}
    </section>
    <section class="card"><h3>Moje chvilky</h3><p class="muted small">Nová chvilka je vždy „Jen já“. Sdílet můžeš po náhledu.</p>
      ${recent.length ? recent.map((m) => `<div class="row between"><div class="grow"><p style="font-size:14px;font-weight:600">${esc(m.customActivityId ? m.label : CAT[m.category]?.title || m.label)}</p><p class="muted small">${m.day === todayStr() ? 'dnes' : esc(m.day)}</p></div>
        <span class="chip${m.visibility === 'JEN_JA' ? '' : ' group'}">${m.visibility === 'JEN_JA' ? 'Jen já' : m.visibility === 'PRATELE' ? 'Přátelé' : 'Skupina'}</span>
        ${m.visibility === 'JEN_JA' ? `<button class="btn ghost small-btn" data-a="openShare" data-id="${esc(m.id)}">Sdílet</button>` : `<button class="btn ghost small-btn" data-a="unshare" data-id="${esc(m.id)}">Zrušit</button>`}</div>`).join('') : '<p class="muted small">Zatím žádné.</p>'}
    </section>
    <section class="card"><h3>Moje data</h3>
      <button class="btn soft" data-a="export">Stáhnout moje data</button>
      <button class="btn soft" data-a="logout">Odhlásit se</button>
      ${S.confirmDelete
        ? `<p class="small">Smazání je nevratné: zmizí chvilky, nálada, zahrada i přátelství.</p><div class="btn-row"><button class="btn ghost" data-a="cancelDelete">Nechat účet</button><button class="btn dark" data-a="deleteAccount">Smazat natrvalo</button></div>`
        : `<button class="btn soft" data-a="askDelete">Smazat účet</button>`}
    </section>
  </div>`;
}

function moodView() {
  const consent = (S.me?.souhlasy || []).some((c) => c.typ === 'ZDRAVOTNI_UDAJE' && c.platny);
  const labels = ['Je to těžké', 'Spíš špatně', 'Ujde to', 'Docela dobře', 'Je mi dobře'];
  return `<div class="screen" style="padding-bottom:28px">
    <button class="btn ghost small-btn" style="align-self:flex-start" data-a="closeOverlay">Zpět</button>
    <div><h1 style="font-size:24px">Jak se dnes máš?</h1><p class="muted">Vidíš to jen ty. Nikdy se nesdílí.</p></div>
    ${!consent
      ? `<section class="card"><h3>Než začneme</h3><p class="muted small">Nálada je citlivý údaj o zdraví. Ukládáme ji, jen když s tím výslovně souhlasíš. Nikdo jiný ji neuvidí a souhlas můžeš kdykoli odvolat.</p>
         <button class="btn" data-a="consentHealth">Souhlasím</button></section>`
      : `<div class="moods" role="radiogroup" aria-label="Nálada">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${S.mood === n}" aria-label="${labels[n - 1]}" data-a="pickMood" data-v="${n}">${n}</button>`).join('')}</div>
         <div class="row between small muted"><span>Je to těžké</span><span>Je mi dobře</span></div>
         ${S.moodResult === 'low' ? `<section class="card" aria-live="polite"><h2>Je nám líto, že je to teď těžké.</h2><p class="green-text" style="line-height:1.5">Nemusíš teď nic plnit ani nikomu nic vysvětlovat. Když budeš chtít, ozvi se někomu blízkému.</p></section>` : ''}
         ${S.moodResult === 'ok' ? `<section class="card" aria-live="polite"><p class="green-text">Díky, je to zapsané. Jen pro tebe.</p></section>` : ''}
         <button class="btn soft" data-a="revokeHealth">Odvolat souhlas s ukládáním nálady</button>`}
    <p class="muted small">U záznamu nálady nejsou body ani oslavy. Aplikace tvoje texty nečte ani nevyhodnocuje.</p>
  </div>`;
}

function shareView() {
  const group = S.groups[0];
  const p = S.preview;
  return `<div class="sheet-wrap" style="background:#8A8E82">
    <div style="flex:1;padding:20px"><button class="btn ghost small-btn" style="background:rgba(255,255,255,.92);border:none" data-a="closeOverlay">Zpět</button></div>
    <section class="sheet dim-bg" aria-label="Náhled sdílení">
      <div class="handle"></div>
      <h1 style="font-size:22px">S kým to sdílet?</h1>
      <div class="pills"><button class="pill" aria-pressed="${S.shareTarget === 'PRATELE'}" data-a="shareTarget" data-v="PRATELE">Přátelé</button>
        ${group ? `<button class="pill" aria-pressed="${S.shareTarget === 'CHILL_CREW'}" data-a="shareTarget" data-v="CHILL_CREW">Skupina ${esc(group.nazev)}</button>` : ''}</div>
      ${p ? `<h2>Takhle to uvidí ostatní</h2><p class="muted">${esc(p.publikum)}</p>
        <div class="card tint" style="padding:16px;flex-direction:row;align-items:center"><div class="avatar" style="background:#fff">${esc((p.nahled?.authorName || '').charAt(0))}</div>
          <div class="grow"><p style="font-weight:600">${esc(p.nahled?.authorName)} · ${esc(p.nahled?.label)}</p><p class="green-text small">${p.nahled?.day === todayStr() ? 'dnes' : esc(p.nahled?.day)}</p></div>
          <span class="chip" style="background:#fff">${S.shareTarget === 'PRATELE' ? 'Přátelé' : 'Skupina'}</span></div>
        <p class="green-text small">✓ Jen druh chvilky a den · ✓ Nálada se nikdy nesdílí · ✓ Sdílení jde kdykoli zrušit</p>
        <button class="btn big" data-a="doShare">Sdílet</button>` : '<p class="muted">Vyber, kdo to má vidět. Pak ti ukážeme náhled.</p>'}
      <button class="btn ghost big" data-a="closeOverlay">Nechat jen pro mě</button>
    </section>
  </div>`;
}

function inviteAcceptView() {
  const p = S.invitePreview || {};
  return `<div class="screen" style="padding-bottom:28px">
    <div style="margin:-24px -20px 0;height:200px;position:relative;overflow:hidden;background:var(--tint)">${GARDEN_SCENE.replace('<svg ', '<svg style="position:absolute;inset:0;width:100%;height:100%" ')}</div>
    ${p.error ? `<h1>Pozvánka už neplatí</h1><p class="muted">Požádej kamaráda o nový odkaz.</p><button class="btn big" data-a="closeInvite">Pokračovat</button>`
      : `<h1>${esc(p.odKoho || '')} tě zve mezi přátele</h1><p class="muted">Když přijmeš, budete hned přátelé. Uvidíte jen to, co si sami nasdílíte.</p>
         <div class="btn-row"><button class="btn ghost big" data-a="closeInvite">Teď ne</button><button class="btn big" data-a="acceptInvite">Přijmout</button></div>`}
  </div>`;
}

function toastView() {
  return S.toast ? `<div class="toast" role="status"><p>${esc(S.toast)}</p><button aria-label="Zavřít oznámení" data-a="closeToast">×</button></div>` : '';
}

function tabbar() {
  const tab = (id, label) => {
    const on = S.tab === id;
    return `<button class="tab" ${on ? 'aria-current="page"' : ''} data-a="tab" data-v="${id}">${ICON.tab[id](on ? '#5F7424' : '#6B7064')}${label}</button>`;
  };
  return `<nav class="tabbar" aria-label="Hlavní navigace">${tab('domu', 'Domů')}${tab('pratele', 'Přátelé')}
    <button class="fab" aria-label="Vybrat chvilku" data-a="tab" data-v="domu">${ICON.plus}</button>${tab('zahrada', 'Zahrada')}${tab('ja', 'Já')}</nav>`;
}

// ---------- akce ----------
const actions = {
  closeToast() { S.toast = null; },
  tab(d) { S.tab = d.v; S.menuFor = null; },
  closeOverlay() { S.overlay = null; S.preview = null; S.shareTarget = null; },
  authMode(d) { S.authMode = d.v; S.authError = null; S.authInfo = null; },
  async resend() {
    await api.resendConfirmation(S.needsConfirm);
    S.authError = null;
    S.authInfo = `Poslali jsme nový potvrzovací e-mail na ${S.needsConfirm}. Klikni na odkaz v něm a pak se přihlas.`;
  },
  async forgot() {
    const email = root.querySelector('#f-email')?.value.trim();
    if (!email) { S.authError = 'Napiš nejdřív svůj e-mail.'; return; }
    await api.resetPassword(email);
    S.authInfo = 'Pokud účet existuje, poslali jsme ti odkaz na nové heslo.';
  },
  demoReset() { if (api.reset) { api.reset(); location.hash = ''; location.reload(); } },
  mode(d) { S.mode[d.cat] = d.v; delete S.sentInvite[d.cat]; },
  pickFriend(d) { S.friendFor[d.cat] = d.id; },
  contribute(_d, el) { S.contribute = el.checked; },
  async inviteFor(d) {
    const friends = confirmedFriends();
    const fid = S.friendFor[d.cat] || friends[0]?.id;
    const res = await api.sendRestInvite(fid, d.cat);
    S.sentInvite[d.cat] = res.id;
    S.invites = await api.restInvites();
    S.toast = `Pozvánka odeslána: ${friends.find((f) => f.id === fid)?.jmeno}.`;
  },
  async complete(d) {
    const goal = myGoal();
    const sent = d.joint ? sentFor(d.cat) : null;
    const res = await api.logMoment({
      category: d.cat,
      ...(sent?.prijato ? { restInvitationId: sent.id } : {}),
      ...(goal && goal.goal.category === d.cat && S.contribute ? { goalIds: [goal.goal.goalId] } : {}),
    });
    delete S.sentInvite[d.cat];
    delete S.mode[d.cat];
    S.lastGrown = d.cat;
    await loadAll();
    celebrate(CAT[d.cat].title, d.cat, res);
  },
  async completeCustom(d) {
    const c = S.custom.find((x) => x.id === d.id);
    const res = await api.logMoment({ category: 'JINE', customActivityId: d.id });
    S.lastGrown = 'JINE';
    await loadAll();
    celebrate(c?.nazev || CAT.JINE.title, 'JINE', res);
  },
  async removeCustom(d) {
    await api.deleteCustomActivity(d.id);
    S.custom = await api.customActivities();
    S.toast = 'Chvilka je odebraná. Co už jsi zapsal(a), v zahradě zůstává.';
  },
  async answerRest(d) {
    await api.answerRestInvite(d.id, d.v);
    S.inviteAnswered[d.id] = d.v;
    S.invites = await api.restInvites();
  },
  goToGoal() {
    S.tab = 'pratele';
    if (S.groups.length) S.goalForm = true;
    S.scrollTo = 'cil';
  },
  weeklyOpen() { S.weeklyForm = true; S.wCat = S.weekly?.category || null; S.wTarget = S.weekly?.cil || 5; },
  weeklyCancel() { S.weeklyForm = false; },
  wCat(d) { S.wCat = d.v || null; },
  wTarget(d) { S.wTarget = Math.max(1, Math.min(50, S.wTarget + Number(d.v))); },
  async weeklySave() {
    const r = await api.setWeeklyGoal(S.wCat, S.wTarget);
    S.weekly = r.cil; S.weeklyForm = false;
    S.toast = 'Cíl na tento týden je nastavený. Každá splněná chvilka se do něj započítá sama.';
  },
  async weeklyDelete() { await api.deleteWeeklyGoal(); S.weekly = null; S.weeklyForm = false; S.toast = 'Tento týden bez cíle. I to je v pořádku.'; },
  goalOpen() { S.goalForm = true; S.goalTarget = 10; S.goalCat = null; },
  goalCancel() { S.goalForm = false; },
  goalCat(d) { S.goalCat = d.v; },
  goalTarget(d) { S.goalTarget = Math.max(1, Math.min(50, S.goalTarget + Number(d.v))); },
  async goalCreate(d) {
    const group = S.groups[0];
    await api.createGoal(group.id, d.v, S.goalTarget);
    S.goalForm = false; S.goalCat = null;
    S.groups = await api.groups();
    S.toast = `Cíl je přidaný: ${S.goalTarget} ${CAT[d.v].gen} spolu. Plnit ho můžete tady nebo na domovské stránce.`;
  },
  async goalDo(d) {
    const res = await api.logMoment({ category: d.cat, goalIds: [d.id] });
    S.lastGrown = d.cat;
    await loadAll();
    const counted = (res.zapocitanoDoCilu || []).includes(d.id);
    const nowReached = S.groups.some((g) => (g.cile || []).some((x) => x.goalId === d.id && x.reached));
    celebrate(CAT[d.cat].title, d.cat, res, nowReached ? 'Společný cíl je splněný! Spolu jste to dali.' : counted ? 'Započítáno do společného cíle.' : '');
  },
  closeCelebrate() { S.celebrate = null; },
  async createInvite() {
    const r = await api.createInvite();
    // Odkaz poskládáme podle adresy, kde aplikace právě běží (GitHub Pages i localhost).
    const token = String(r.odkaz).split('/').pop();
    S.inviteLink = `${location.origin}${location.pathname}#/pozvanka/${token}`;
  },
  async copyLink() { try { await navigator.clipboard.writeText(S.inviteLink); S.toast = 'Odkaz je zkopírovaný.'; } catch { S.toast = 'Odkaz označ a zkopíruj ručně.'; } },
  async shareLink() { try { await navigator.share({ title: 'Odpočívat spolu', text: 'Pojď se mnou odpočívat:', url: S.inviteLink }); } catch { /* zrušeno */ } },
  async confirmFriend(d) { await api.confirmFriend(d.id); S.friends = await api.friends(); S.toast = 'Jste přátelé.'; },
  async removeFriend(d) { await api.removeFriend(d.id); S.friends = await api.friends(); S.menuFor = null; },
  async answerGroup(d) { await api.answerGroupInvite(d.id, d.v === '1'); S.groupInvites = await api.groupInvitations(); S.groups = await api.groups(); },
  menu(d) { S.menuFor = S.menuFor === d.id ? null : d.id; },
  async ping(d) { await api.sendPing(d.id, d.v); S.pinged[d.id] = true; S.game = await api.game(); S.toast = 'Povzbuzení odesláno. Nemusí odpovídat.'; },
  async inviteToGroup(d) { await api.inviteToGroup(S.groups[0].id, d.id); S.menuFor = null; S.toast = 'Pozvánka do skupiny odeslána. Až ji kamarád přijme, uvidí váš cíl.'; },
  async block(d) {
    const f = S.friends.find((x) => x.id === d.id);
    await api.block(d.id);
    S.menuFor = null;
    await loadAll();
    S.toast = `${f?.jmeno || 'Kamarád'} je zablokovaný/á. Nedostane o tom žádné oznámení.`;
  },
  async report(d) {
    const r = await api.report({ reportedUserId: d.id, reason: 'OBTEZOVANI', contextType: 'profile', alsoBlock: true });
    S.menuFor = null;
    await loadAll();
    S.toast = `${r.text} Člověka jsme zároveň zablokovali.`;
  },
  async setting(d) {
    const cur = !!S.me.nastaveni[d.v];
    S.me = await api.settings({ [d.v]: !cur });
    S.game = await api.game();
  },
  openMood() { S.overlay = 'nalada'; S.mood = null; S.moodResult = null; },
  async consentHealth() { S.me = await api.consent('ZDRAVOTNI_UDAJE', true); },
  async revokeHealth() { S.me = await api.consent('ZDRAVOTNI_UDAJE', false); S.toast = 'Souhlas je odvolaný. Další náladu už neukládáme.'; },
  async pickMood(d) {
    S.mood = Number(d.v);
    const r = await api.checkin(S.mood);
    S.moodResult = r.nabidnoutPomoc ? 'low' : 'ok';
  },
  openShare(d) { S.overlay = 'sdileni'; S.shareFor = d.id; S.shareTarget = null; S.preview = null; },
  async shareTarget(d) {
    S.shareTarget = d.v;
    S.preview = await api.sharePreview(S.shareFor, d.v, d.v === 'CHILL_CREW' ? S.groups[0]?.id : undefined);
  },
  async doShare() {
    await api.share(S.shareFor, S.shareTarget, S.preview.previewToken, S.shareTarget === 'CHILL_CREW' ? S.groups[0]?.id : undefined);
    S.moments = await api.moments();
    S.overlay = null; S.preview = null;
    S.toast = 'Nasdíleno. Kdykoli to vrátíš na „Jen já“.';
  },
  async unshare(d) { await api.unshare(d.id); S.moments = await api.moments(); S.toast = 'Zase jen pro tebe.'; },
  async acceptInvite() {
    await api.acceptInvite(S.inviteToken);
    actions.closeInvite();
    S.friends = await api.friends();
    S.toast = `Hotovo, ${S.invitePreview?.odKoho || 'kamarád'} a ty jste přátelé.`;
  },
  closeInvite() { S.overlay = null; S.inviteToken = null; S.invitePreview = null; history.replaceState(null, '', location.pathname); },
  async export() {
    const data = await api.exportData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'odpocivat-spolu-moje-data.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async logout() { await api.signOut(); location.reload(); },
  askDelete() { S.confirmDelete = true; },
  cancelDelete() { S.confirmDelete = false; },
  async deleteAccount() { await api.deleteAccount(); await api.signOut(); location.reload(); },
};

root.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || !root.contains(el)) return;
  const fn = actions[el.dataset.a];
  if (!fn) return;
  if (el.tagName === 'A') ev.preventDefault();
  guard(() => fn(el.dataset, el));
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && S.celebrate) { S.celebrate = null; render(); }
});

root.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const f = Object.fromEntries(new FormData(form));
  if (form.dataset.form === 'auth') {
    guard(async () => {
      S.authError = null; S.authInfo = null; S.needsConfirm = null;
      try {
      const email = String(f.email || '').trim();
      const password = String(f.password || '');
      if (!email || !password) { S.authError = 'Vyplň e-mail a heslo.'; return; }
      if (S.authMode === 'register') {
        const name = String(f.name || '').trim();
        if (!name) { S.authError = 'Vyplň přezdívku.'; return; }
        if (password.length < 10) { S.authError = 'Heslo musí mít aspoň 10 znaků.'; return; }
        if (!f.terms) { S.authError = 'Pro vytvoření účtu potřebujeme souhlas s podmínkami.'; return; }
        store.set('os-pending-name', name);
        const r = await api.signUp(email, password);
        if (r.needsConfirmation) {
          S.authInfo = `Poslali jsme ti e-mail na ${email}. Klikni na odkaz v něm (zkontroluj i Hromadné a Spam) a pak se tady přihlas.`;
          S.authMode = 'login';
          S.needsConfirm = email;
          return;
        }
      } else {
        await api.signIn(email, password);
      }
      await boot();
      } catch (e) {
        // Na přihlašovací obrazovce se chyba ukáže přímo nad formulářem (ne v oznámení).
        S.authError = e.message || 'Něco se pokazilo.';
        if (e.code === 'NEPOTVRZENO') S.needsConfirm = String(f.email || '').trim();
      }
    });
  }
  if (form.dataset.form === 'custom') {
    guard(async () => {
      const title = String(f.title || '').trim();
      if (!title) return;
      await api.createCustomActivity(title);
      S.custom = await api.customActivities();
      S.toast = `Vlastní chvilka „${title}“ je na seznamu.`;
    });
  }
  if (form.dataset.form === 'group') {
    guard(async () => {
      const name = String(f.name || '').trim();
      if (!name) return;
      await api.createGroup(name);
      S.groups = await api.groups();
      S.goalForm = true; S.goalTarget = 10; S.goalCat = null;
      S.toast = 'Skupina je založená. Teď si dejte cíl a pozvěte kamarády.';
    });
  }
  if (form.dataset.form === 'profile') {
    guard(async () => {
      const name = String(f.name || '').trim();
      if (!name) return;
      await api.createProfile(name);
      await api.consent('PODMINKY', true);
      await boot();
    });
  }
});

window.addEventListener('demo-update', async (e) => { S.invites = await api.restInvites(); toast(e.detail); });
window.addEventListener('hashchange', () => { readHash(); if (S.inviteToken && S.phase === 'app') boot(); });

let lastView = '';
let lastToast = null;
let lastCelebrate = null;
let toastTimer;
function render() {
  const focusId = document.activeElement?.id;
  const scroller = root.querySelector('.screen');
  const scroll = scroller ? scroller.scrollTop : 0;
  const where = `${S.phase}:${S.overlay || S.tab}`;
  // Přechod na jinou obrazovku schová staré oznámení, aby nepřekrývalo tlačítka.
  if (where !== lastView && lastView && S.toast && S.toast === lastToast) S.toast = null;
  if (S.toast && S.toast !== lastToast) {
    lastToast = S.toast;
    S.toastWhere = where;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { S.toast = null; lastToast = null; render(); }, 5000);
  }
  if (!S.toast) lastToast = null;
  root.innerHTML = view();
  const next = root.querySelector('.screen');
  // Na stejné obrazovce zůstane posunutí, nová obrazovka začne nahoře.
  if (next && where === lastView) next.scrollTop = scroll;
  lastView = where;
  if (S.celebrate) {
    // Animace a fokus jen při otevření, ne při každém dalším překreslení.
    if (S.celebrate !== lastCelebrate) root.querySelector('#cel-ok')?.focus();
    lastCelebrate = S.celebrate;
  } else lastCelebrate = null;
  if (S.scrollTo) { root.querySelector(`#${CSS.escape(S.scrollTo)}`)?.scrollIntoView({ block: 'start' }); S.scrollTo = null; }
  if (focusId) root.querySelector(`#${CSS.escape(focusId)}`)?.focus();
}

render();
boot().catch((e) => { S.phase = 'auth'; S.authError = e.message; render(); });
})();
