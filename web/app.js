// Odpočívat spolu – webová aplikace. Bez frameworku: stav -> HTML -> obsluha kliknutí.
// Veškerý text od uživatelů (přezdívky, názvy skupin) prochází přes esc() kvůli bezpečnosti.
(() => {
'use strict';

const { createApi, CATEGORIES, CAT, levelPoints } = window.OS;
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
const STAGES = ['Semínko', 'Klíček', 'Roste', 'Kvete', 'Kvete naplno'];
const CRISIS = [
  { name: 'Linka první psychické pomoci', desc: 'Když je ti psychicky těžko. Nonstop.', tel: '116123', show: '116 123' },
  { name: 'Linka bezpečí', desc: 'Pro děti a studenty do 26 let. Nonstop.', tel: '116111', show: '116 111' },
];

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

function plantSvg(c, n) {
  const st = Math.min(n, 4);
  const top = [66, 52, 40, 28, 24][st];
  const fr = st >= 3 ? (st === 4 ? 12 : 9) : st === 2 ? 4 : 0;
  return `<svg width="72" height="72" viewBox="0 0 80 80" role="img" aria-label="${esc(c.plant)}: ${STAGES[st]}">
    <ellipse cx="40" cy="70" rx="30" ry="7" fill="#A9B676"/>
    ${st === 0 ? '<circle cx="40" cy="66" r="4" fill="#8B6B4A"/>' : `<line x1="40" y1="68" x2="40" y2="${top}" stroke="#5F7424" stroke-width="3" stroke-linecap="round"/>`}
    ${st >= 1 ? `<ellipse cx="32" cy="${top + 16}" rx="8" ry="4" fill="#7E9240"/>` : ''}
    ${st >= 2 ? `<ellipse cx="48" cy="${top + 9}" rx="8" ry="4" fill="#8FA34A"/>` : ''}
    ${fr ? `<circle cx="40" cy="${top}" r="${fr}" fill="${c.flower}"/>` : ''}
    ${st >= 3 ? `<circle cx="40" cy="${top}" r="3.5" fill="#FFF6D6"/>` : ''}
    ${st === 4 ? `<circle cx="24" cy="${top + 26}" r="6" fill="${c.flower}"/><circle cx="57" cy="${top + 26}" r="6" fill="${c.flower}"/>` : ''}
  </svg>`;
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
  overlay: null, // pomoc | nalada | sdileni | pozvanka
  authMode: 'login', authError: null, authInfo: null, busy: false,
  me: null, game: null, moments: [], friends: [], feed: [], pings: [], invites: [], groups: [], groupInvites: [],
  mode: {}, friendFor: {}, sentInvite: {}, contribute: true,
  lastGrown: null, toast: null, menuFor: null, pinged: {}, inviteLink: null,
  inviteToken: null, invitePreview: null,
  mood: null, moodResult: null,
  shareFor: null, shareTarget: null, preview: null,
  confirmDelete: false, inviteAnswered: {},
};

function toast(msg) { S.toast = msg; render(); }

async function guard(fn) {
  if (S.busy) return;
  S.busy = true;
  try { await fn(); } catch (e) { S.toast = e.message || 'Něco se pokazilo.'; } finally { S.busy = false; render(); }
}

async function loadAll() {
  const [me, game, ms, friends, feed, pings, invites, groups, gi] = await Promise.all([
    api.me(), api.game(), api.moments(), api.friends(), api.feed(), api.pings(), api.restInvites(), api.groups(), api.groupInvitations(),
  ]);
  Object.assign(S, { me, game, moments: ms, friends, feed, pings, invites, groups, groupInvites: gi });
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
  if (S.overlay === 'pomoc') return demo + helpView();
  if (S.overlay === 'nalada') return demo + moodView() + toastView();
  if (S.overlay === 'sdileni') return demo + shareView() + toastView();
  if (S.overlay === 'pozvanka') return demo + inviteAcceptView();
  const screens = { domu: homeView, pratele: friendsView, zahrada: gardenView, ja: meView };
  return demo + screens[S.tab]() + toastView() + tabbar();
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
    <button class="btn ghost" type="button" data-a="openHelp">Potřebuješ pomoc hned?</button>
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
  for (const g of S.groups) for (const c of g.cile || []) return { group: g, goal: c };
  return null;
}
function sentFor(cat) {
  const id = S.sentInvite[cat];
  return id ? S.invites.find((i) => i.id === id) || { id, prijato: false, waiting: true } : null;
}
function doneToday(cat) {
  const t = todayStr();
  return S.moments.filter((m) => m.category === cat && m.status === 'SPLNENO' && m.day === t).length;
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
    : `<section class="card"><p class="label">Společný cíl</p><h2>Odpočívejte spolu</h2><p class="muted">Založ skupinu a dejte si společný týdenní cíl, třeba 10 procházek. Uvidíte jen společný součet.</p>
        <button class="btn" data-a="createGroup">Založit skupinu Chill crew</button></section>`;
  const inviteCard = incoming
    ? `<section class="card"><div><p class="label">${esc(incoming.kdo)} tě zve</p><h2 style="font-size:17px">${esc(CAT[incoming.kategorie]?.title || incoming.text)}: přidáš se?</h2></div>
        ${S.inviteAnswered[incoming.id]
          ? `<p class="small green-text" aria-live="polite">${S.inviteAnswered[incoming.id] === 'PRIDAM_SE' ? 'Super, užijte si to spolu. Až to bude, zapiš to jako společnou chvilku.' : 'V pohodě. Nic vysvětlovat nemusíš.'}</p>`
          : `<div class="btn-row"><button class="btn ghost" data-a="answerRest" data-id="${esc(incoming.id)}" data-v="TED_NE">Teď ne</button><button class="btn" data-a="answerRest" data-id="${esc(incoming.id)}" data-v="PRIDAM_SE">Přidám se</button></div>`}
      </section>`
    : '';
  const tasks = CATEGORIES.map((c) => taskCard(c, goal)).join('');
  return `<div class="screen home">
    <header class="hero">
      <div class="hero-top">
        ${g.hraZapnuta ? `<button class="btn soft small-btn" style="background:#fff;color:var(--ink-green)" data-a="tab" data-v="zahrada">Úroveň ${esc(g.uroven)} · Zahrada</button>` : `<p class="label green-text">${new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>`}
        <button class="icon-btn" aria-label="Potřebuješ pomoc hned?" data-a="openHelp">${ICON.heart}</button>
      </div>
      <h1>Ahoj, ${esc(name)}</h1>
      <p class="green-text" style="font-size:16px">Jak si dnes odpočineš?</p>
    </header>
    <div class="home-body">
      ${goalCard}
      ${inviteCard}
      <div><h2 style="font-size:19px">Vyber si chvilku pro sebe</h2><p class="muted small">Sám, sama, nebo s někým. Každá splněná chvilka nechá něco vyrůst v zahradě.</p></div>
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
  const done = doneToday(c.id) > 0;
  const goalMatch = goal && goal.goal.category === c.id;
  let action;
  if (!spolu) action = `<button class="btn" data-a="complete" data-cat="${c.id}">Hotovo</button>`;
  else if (!friends.length) action = `<p class="small muted">Zatím nemáš kamarády. Pozvi je v záložce Přátelé.</p>`;
  else if (!sent) action = `<button class="btn" data-a="inviteFor" data-cat="${c.id}">Pozvat: ${esc(friend?.jmeno)}</button>`;
  else if (sent.prijato) action = `<button class="btn" data-a="complete" data-cat="${c.id}" data-joint="1">Splněno spolu s ${esc(friend?.jmeno)}</button>`;
  else action = `<p class="small green-text">Pozvánka odeslána: ${esc(friend?.jmeno)}. Odmítnout jde jedním klepnutím, bez vysvětlování.</p>
      <button class="btn ghost" data-a="complete" data-cat="${c.id}">Splnit i tak sám/sama</button>`;
  return `<section class="card${done ? ' done' : ''}">
    <div class="row"><div class="task-icon">${taskIcon(c.flower)}</div><div class="grow"><h3>${c.title}</h3><p class="muted small">${c.hint}</p></div><span class="chip">${spolu ? 'Spolu' : 'Jen já'}</span></div>
    ${done
      ? `<div class="row between"><p class="small green-text" style="font-weight:600">Hotovo · roste ${c.plant}</p><button class="btn ghost small-btn" data-a="complete" data-cat="${c.id}">Zapsat znovu</button></div>`
      : `<div class="stack">
        <div class="seg" role="group" aria-label="S kým"><button type="button" aria-pressed="${!spolu}" data-a="mode" data-cat="${c.id}" data-v="sam">Sám / sama</button><button type="button" aria-pressed="${spolu}" data-a="mode" data-cat="${c.id}" data-v="spolu">S kamarádem</button></div>
        ${spolu && friends.length && !sent ? `<div class="pills"><span class="small muted">Pozvat:</span>${friends.map((f) => `<button type="button" class="pill" aria-pressed="${f.id === friendId}" data-a="pickFriend" data-cat="${c.id}" data-id="${esc(f.id)}">${esc(f.jmeno)}</button>`).join('')}</div>` : ''}
        ${goalMatch ? `<label class="check small"><input type="checkbox" data-a="contribute" ${S.contribute ? 'checked' : ''}> <span>Započítat do cíle skupiny ${esc(goal.group.nazev)} (skupina uvidí jen společný součet)</span></label>` : ''}
        ${action}
      </div>`}
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
      <div class="stack" style="gap:6px"><h2>Odpočívat spolu je víc</h2><p class="green-text small" style="line-height:1.5">Pošli kamarádovi osobní odkaz. Přáteli budete, až to potvrdíte oba.</p></div>
      ${S.inviteLink
        ? `<div class="field"><label for="f-link">Odkaz platí 3 dny a jen pro jednoho člověka</label><input id="f-link" readonly value="${esc(S.inviteLink)}"></div>
           <div class="btn-row"><button class="btn" data-a="copyLink">Zkopírovat</button>${navigator.share ? '<button class="btn ghost" data-a="shareLink">Poslat…</button>' : ''}</div>`
        : `<button class="btn big" data-a="createInvite">Pozvat kamaráda odkazem</button>`}
    </section>
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

function gardenView() {
  const g = S.game || {};
  if (!g.hraZapnuta) {
    return `<div class="screen"><div><h1>Tvoje zahrada</h1></div><section class="card"><p class="green-text">Herní prvky máš vypnuté. Zahrada na tebe počká přesně tak, jak je.</p></section></div>`;
  }
  const lo = levelPoints(g.uroven);
  const pct = Math.max(4, Math.round((100 * (g.body - lo)) / (g.dalsiUrovenPri - lo)));
  const garden = g.zahrada || {};
  return `<div class="screen">
    <div><h1>Tvoje zahrada</h1><p class="muted">Každá chvilka pro tebe nechá něco vyrůst. Nic tu nevadne.</p></div>
    ${g.zprava ? `<section class="card tint" style="padding:14px 18px"><p class="green-text">${esc(g.zprava)}</p></section>` : ''}
    <section class="card"><div class="row between"><h2>Úroveň ${esc(g.uroven)}</h2><p class="muted small">Tento týden ${moments(g.chvilekTentoTyden || 0)}</p></div>
      <div class="bar" role="img" aria-label="Cesta k další úrovni"><span style="width:${pct}%"></span></div></section>
    <section class="garden" aria-label="Rostliny v zahradě">
      ${CATEGORIES.map((c) => { const n = garden[c.id] || 0; return `<div class="plot${S.lastGrown === c.id ? ' grew' : ''}">${plantSvg(c, n)}<p class="name">${c.plant}</p><p class="green-text">${STAGES[Math.min(n, 4)]} · ${moments(n)}</p></div>`; }).join('')}
    </section>
    <section class="card"><h3>Jak zahrada roste</h3><p class="muted small">Semínko → klíček → roste → kvete → kvete naplno. Každý druh odpočinku má svou rostlinu. Pauza ani vynechaný týden nic nevezmou.</p>
      <button class="btn" data-a="tab" data-v="domu">Vybrat chvilku</button></section>
  </div>`;
}

function meView() {
  const st = S.me?.nastaveni || {};
  const g = S.game || {};
  const owned = new Set((g.odznaky || []).map((b) => b.code));
  const all = [['PRVNI_CHVILKA', 'První chvilka'], ['NAVRAT', 'Návrat'], ['DOBRY_KAMARAD', 'Dobrý kamarád'], ['BEZ_TELEFONU', 'Bez obrazovky'], ['SPOLU', 'Spolu'], ['PESTROST', 'Pestrost']];
  const toggle = (key, label, hint) => `<div class="setting"><div class="grow"><p style="font-weight:600">${label}</p><p class="muted small">${hint}</p></div>
    <button type="button" class="switch" role="switch" aria-checked="${!!st[key]}" aria-label="${label}" data-a="setting" data-v="${key}"><span></span></button></div>`;
  const recent = S.moments.filter((m) => m.status === 'SPLNENO').slice(0, 6);
  const name = S.me?.profil?.prezdivka || '';
  return `<div class="screen">
    <div class="row"><div class="avatar" style="width:56px;height:56px;font-size:22px">${esc(name.charAt(0))}</div><div><h1 style="font-size:24px">${esc(name)}</h1><p class="muted small">Přezdívku vidí jen tvoji přátelé.</p></div></div>
    <button class="card" style="text-align:left;border:none;cursor:pointer;flex-direction:row;align-items:center;justify-content:space-between" data-a="openMood">
      <span><b>Jak se dnes mám?</b><br><span class="muted small">Záznam nálady vidíš jen ty</span></span>${ICON.chevron}</button>
    <section class="card" style="padding:6px 18px;gap:0">
      ${toggle('gameEnabled', 'Herní prvky', 'Zahrada, úrovně, odznaky. Vypnutí ostatní nevidí.')}
      ${toggle('quietHoursEnabled', `Noční klid ${esc(st.quietStart || '22:00')}–${esc(st.quietEnd || '08:00')}`, 'V noci žádné notifikace')}
      ${toggle('shareBadges', 'Sdílet odznaky s přáteli', 'Ve výchozím stavu vypnuto')}
      ${toggle('receivePings', 'Přijímat povzbuzení', 'Když vypneš, odesílatel se to nedozví')}
      ${toggle('receiveRestInvites', 'Přijímat pozvánky k odpočinku', 'Když vypneš, odesílatel se to nedozví')}
    </section>
    ${g.hraZapnuta ? `<section class="card"><h3>Odznaky za péči</h3><div class="badges">${all.map(([code, label]) => `<div class="badge${owned.has(code) ? ' on' : ''}">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${owned.has(code) ? '#5F7424' : '#9A9E92'}" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="10" r="6"/><path d="M8.5 15l-1.5 6 5-2.5 5 2.5-1.5-6"/></svg>
      <p>${label}</p><small>${owned.has(code) ? 'Získáno' : 'Čeká na tebe'}</small></div>`).join('')}</div></section>` : ''}
    <section class="card"><h3>Moje chvilky</h3><p class="muted small">Nová chvilka je vždy „Jen já“. Sdílet můžeš po náhledu.</p>
      ${recent.length ? recent.map((m) => `<div class="row between"><div class="grow"><p style="font-size:14px;font-weight:600">${esc(CAT[m.category]?.title || m.label)}</p><p class="muted small">${m.day === todayStr() ? 'dnes' : esc(m.day)}</p></div>
        <span class="chip${m.visibility === 'JEN_JA' ? '' : ' group'}">${m.visibility === 'JEN_JA' ? 'Jen já' : m.visibility === 'PRATELE' ? 'Přátelé' : 'Skupina'}</span>
        ${m.visibility === 'JEN_JA' ? `<button class="btn ghost small-btn" data-a="openShare" data-id="${esc(m.id)}">Sdílet</button>` : `<button class="btn ghost small-btn" data-a="unshare" data-id="${esc(m.id)}">Zrušit</button>`}</div>`).join('') : '<p class="muted small">Zatím žádné.</p>'}
    </section>
    <button class="btn ghost" data-a="openHelp">Potřebuješ pomoc hned?</button>
    <section class="card"><h3>Moje data</h3>
      <button class="btn soft" data-a="export">Stáhnout moje data</button>
      <button class="btn soft" data-a="logout">Odhlásit se</button>
      ${S.confirmDelete
        ? `<p class="small">Smazání je nevratné: zmizí chvilky, nálada, zahrada i přátelství.</p><div class="btn-row"><button class="btn ghost" data-a="cancelDelete">Nechat účet</button><button class="btn dark" data-a="deleteAccount">Smazat natrvalo</button></div>`
        : `<button class="btn soft" data-a="askDelete">Smazat účet</button>`}
    </section>
  </div>`;
}

function helpView() {
  return `<div class="sheet-wrap">
    <div class="sheet-top">${GARDEN_SCENE}<button class="btn ghost small-btn" style="background:rgba(255,255,255,.92);border:none" data-a="closeOverlay">Zavřít</button></div>
    <section class="sheet" aria-label="Linky pomoci">
      <div class="handle"></div>
      <h1 style="font-size:22px">Pomoc je na dosah</h1>
      <p class="muted">Nemusíš na to být sám ani sama. Linky jsou zdarma a kdykoli.</p>
      ${CRISIS.map((c) => `<div class="help-card"><div class="grow"><h3>${c.name}</h3><p class="muted small">${c.desc}</p></div><a class="btn" href="tel:${c.tel}">${c.show}</a></div>`).join('')}
      <div class="help-card urgent"><div class="grow"><h3>V ohrožení života</h3><p class="green-text small">Záchranná služba nebo tísňová linka.</p></div><a class="btn dark" href="tel:155">155</a><a class="btn dark" href="tel:112">112</a></div>
      <p class="muted small">Aplikace ani kamarádi odbornou pomoc nenahradí.</p>
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
         ${S.moodResult === 'low' ? `<section class="card" aria-live="polite"><h2>Je nám líto, že je to teď těžké.</h2><p class="green-text" style="line-height:1.5">Nemusíš teď nic plnit ani nikomu nic vysvětlovat. Když budeš chtít s někým mluvit, pomoc je na dosah.</p><button class="btn big" data-a="openHelp">Potřebuješ pomoc hned?</button></section>` : ''}
         ${S.moodResult === 'ok' ? `<section class="card" aria-live="polite"><p class="green-text">Díky, je to zapsané. Jen pro tebe.</p></section>` : ''}
         <button class="btn soft" data-a="revokeHealth">Odvolat souhlas s ukládáním nálady</button>`}
    <p class="muted small">U záznamu nálady nejsou body, odznaky ani oslavy. Aplikace tvoje texty nečte ani nevyhodnocuje.</p>
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
      : `<h1>${esc(p.odKoho || '')} tě zve mezi přátele</h1><p class="muted">Když přijmeš, ${esc(p.odKoho || '')} to ještě potvrdí. Pak uvidíte jen to, co si sami nasdílíte.</p>
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
  openHelp() { S.overlay = 'pomoc'; },
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
    S.lastGrown = d.cat;
    await loadAll();
    const plant = CAT[d.cat].plant;
    S.toast = S.game?.hraZapnuta ? `${res.zprava} V zahradě roste: ${plant}.` : res.zprava || 'Chvilka pro tebe je zapsaná.';
  },
  async answerRest(d) {
    await api.answerRestInvite(d.id, d.v);
    S.inviteAnswered[d.id] = d.v;
    S.invites = await api.restInvites();
  },
  async createGroup() {
    const g = await api.createGroup('Chill crew');
    await api.createGoal(g.id, 'PROCHAZKA', 10);
    S.groups = await api.groups();
    S.toast = 'Skupina je založená. Pozvi do ní kamarády v záložce Přátelé (tři tečky u jména).';
  },
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
  async inviteToGroup(d) { await api.inviteToGroup(S.groups[0].id, d.id); S.menuFor = null; S.toast = 'Pozvánka do skupiny odeslána.'; },
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
    S.toast = `Žádost odeslána. ${S.invitePreview?.odKoho || 'Kamarád'} ji ještě potvrdí.`;
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
  if (focusId) root.querySelector(`#${CSS.escape(focusId)}`)?.focus();
}

render();
boot().catch((e) => { S.phase = 'auth'; S.authError = e.message; render(); });
})();
