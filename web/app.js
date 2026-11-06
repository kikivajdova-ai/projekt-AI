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
const moments = (n) => (n === 1 ? '1 chvilka' : n >= 2 && n <= 4 ? `${n} chvilky` : `${n} chvilek`);

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

// Rostlina, která ke druhu chvilky patří (ikona na kartě a květina v okénku Skvělá práce).
const CAT_PLANT = { PROCHAZKA: 'tree', CTENI: 'daisy', PAUZA: 'tulip', SPANEK: 'lavender', BEZ_TELEFONU: 'sunflower', POHYB: 'dot', TVORENI: 'sunflower:oranzova', JINE: 'tulip:zluty' };
const PLANT_BOX = { tree: '110 110 740 720', sunflower: '170 110 620 720', 'sunflower:oranzova': '170 110 620 720' };
function plantArt(cat) {
  const key = CAT_PLANT[cat] || 'tulip';
  return { art: window.FLOWER_ART?.[key]?.[2] || window.FLOWER_ART?.[key.split(':')[0]]?.[2] || '', box: PLANT_BOX[key] || '200 190 560 640' };
}
function taskIcon(cat) {
  const { art, box } = plantArt(cat);
  return `<svg width="34" height="34" viewBox="${box}" aria-hidden="true">${art}</svg>`;
}

// Obecná ilustrace rozkvetlé zahrady (přihlášení, hlavička, sdílení bez hry). Stejný styl jako zahrada.
function gardenHero(level = 1) {
  return gardenScene(GARDEN_STEPS + 18, -1, level, true).replace('role="img" aria-label="Tvoje zahrada: ', 'role="img" aria-label="Ilustrace rozkvetlé zahrady: ');
}

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
    cat,
    text: game ? 'Tvoje zahrada je zase o kousek krásnější.' : 'Chvilka pro tebe je zapsaná.',
    extra: [extra, note].filter(Boolean).join(' '),
  };
}

function celebrateView() {
  const c = S.celebrate;
  if (!c) return '';
  return `<div class="modal-layer">
    <div class="modal-backdrop" data-a="closeCelebrate"></div>
    <div class="modal${c === lastCelebrate ? ' static' : ''}" role="dialog" aria-modal="true" aria-labelledby="cel-title">
      ${(() => { const { art, box } = plantArt(c.cat); return `<svg class="grow-flower" width="150" height="150" viewBox="${box}" aria-hidden="true">
        <ellipse cx="480" cy="812" rx="210" ry="34" fill="#DDE8C8"/>
        <g class="gf-plant">${art}</g>
        <g class="gf-spark" fill="#F7D36A"><circle cx="230" cy="330" r="16"/><circle cx="730" cy="280" r="13"/><circle cx="760" cy="520" r="15"/><circle cx="200" cy="560" r="12"/><circle cx="640" cy="180" r="10" fill="#F49AB6"/><circle cx="300" cy="200" r="9" fill="#8CC6D2"/></g>
      </svg>`; })()}
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
  return demo + sidebar() + screens[S.tab]() + toastView() + tabbar() + celebrateView();
}

function authView() {
  const reg = S.authMode === 'register';
  return `<div class="screen auth" style="padding-bottom:28px">
    <div class="auth-art"><div class="only-narrow">${gardenHero()}</div>
      <div class="only-wide">${gardenScene(44, -1, 5)}</div></div>
    <div class="auth-form">
    <h1>Odpočívat spolu</h1>
    <p class="muted">Odpočinek místo výkonu. Spolu s kamarády, bez tlaku a srovnávání.</p>
    <p class="small green-text" style="line-height:1.5">Vybíráš si malé chvilky odpočinku, třeba procházku nebo večer bez telefonu. S každou z nich rozkvétá tvoje zahrada. S kamarády si můžete dát společnou výzvu.</p>
    <div class="seg" role="group" aria-label="Přihlášení nebo registrace">
      <button type="button" aria-pressed="${!reg}" data-a="authMode" data-v="login">Přihlásit se</button>
      <button type="button" aria-pressed="${reg}" data-a="authMode" data-v="register">Nový účet</button>
    </div>
    ${S.authError ? `<p class="error" role="alert">${esc(S.authError)}</p>` : ''}
    ${S.authInfo ? `<p class="card tint" style="padding:14px 16px" role="status">${esc(S.authInfo)}</p>` : ''}
    ${S.needsConfirm ? `<button class="btn ghost" type="button" data-a="resend">Poslat potvrzovací e-mail znovu</button>` : ''}
    <form data-form="auth" class="stack" novalidate>
      ${reg ? `<div class="field"><label for="f-name">Přezdívka (uvidí ji jen tví přátelé)</label><input id="f-name" name="name" maxlength="40" required autocomplete="nickname"></div>` : ''}
      <div class="field"><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="f-pass">Heslo${reg ? ' (aspoň 10 znaků)' : ''}</label><input id="f-pass" name="password" type="password" minlength="${reg ? 10 : 1}" required autocomplete="${reg ? 'new-password' : 'current-password'}"></div>
      ${reg ? `<label class="check"><input type="checkbox" name="terms" required> <span>Souhlasím s podmínkami a zásadami ochrany soukromí.</span></label>` : ''}
      <button class="btn big" type="submit" ${S.busy ? 'disabled' : ''}>${reg ? 'Vytvořit účet' : 'Přihlásit se'}</button>
      ${reg ? '' : '<button class="btn ghost" type="button" data-a="forgot">Zapomenuté heslo</button>'}
    </form>
    </div>
  </div>`;
}

function onboardingView() {
  return `<div class="screen" style="padding-bottom:28px">
    <h1>Jak ti máme říkat?</h1>
    <p class="muted">Přezdívku uvidí jen kamarádi, které si sem pozveš.</p>
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
    ? `<section class="card"><div class="row between"><div><p class="label">Společná výzva týdne</p><h2>${esc(goal.group.nazev)}</h2></div><span class="chip group">Skupina</span></div>
        <p style="font-size:15px">${esc(goal.goal.text)}</p>
        <div class="bar" role="img" aria-label="${esc(goal.goal.text)}"><span style="width:${Math.min(100, Math.round((100 * goal.goal.together) / goal.goal.target))}%"></span></div></section>`
    : weeklyCard();
  const inviteCard = incoming
    ? `<section class="card"><div><p class="label">${esc(incoming.kdo)} tě zve ke společnému odpočinku</p><h2 style="font-size:17px">${esc(CAT[incoming.kategorie]?.title || incoming.text)}: přidáš se?</h2></div>
        ${S.inviteAnswered[incoming.id]
          ? `<p class="small green-text" aria-live="polite">${S.inviteAnswered[incoming.id] === 'PRIDAM_SE' ? 'Super, užijte si to spolu. Až to bude, zapiš si to na kartě chvilky.' : 'V pohodě. Nic vysvětlovat nemusíš, kamarád se dozví jen „teď ne“.'}</p>`
          : `<div class="btn-row"><button class="btn ghost" data-a="answerRest" data-id="${esc(incoming.id)}" data-v="TED_NE">Teď ne</button><button class="btn" data-a="answerRest" data-id="${esc(incoming.id)}" data-v="PRIDAM_SE">Přidám se</button></div>`}
      </section>`
    : '';
  const tasks = PRESETS.map((c) => taskCard(c)).join('') + S.custom.map(customCard).join('') + customCreateCard();
  return `<div class="screen home">
    <header class="hero">
      <div class="hero-top">
        ${g.hraZapnuta ? `<button class="btn soft small-btn" style="background:#fff;color:var(--ink-green)" data-a="tab" data-v="zahrada">Úroveň ${esc(g.uroven)} · Moje zahrada</button>` : `<p class="label green-text">${new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>`}
      </div>
      <h1>Ahoj, ${esc(name)}</h1>
      <p class="green-text" style="font-size:16px">Jak si dnes odpočineš?</p>
      <div class="hero-art" aria-hidden="true">${gardenHero()}</div>
    </header>
    <div class="home-body">
      <div class="home-side">
        ${goalCard}
        ${inviteCard}
      </div>
      <div class="home-main">
        <div><h2 style="font-size:19px">Vyber si chvilku pro sebe</h2><p class="muted small">Když si chvilku dopřeješ, klepni na „Zapsat chvilku“ a tvoje zahrada zase o kousek rozkvete. Chceš ji zažít s někým? Klepni na „Přizvat kamaráda“. Chybí ti tu něco? Úplně dole si vytvoříš vlastní.</p></div>
        <div class="tasks">${tasks}</div>
      </div>
    </div>
  </div>`;
}

// Karta chvilky: hlavně Hotovo. „Přizvat kamaráda“ je vedlejší volba (pozvánka jednomu kamarádovi).
// Do společné výzvy skupiny se chvilka započítá sama (dá se vypnout v Já).
function taskCard(c) {
  const spolu = S.mode[c.id] === 'spolu';
  const friends = confirmedFriends();
  const friendId = S.friendFor[c.id] || friends[0]?.id;
  const friend = friends.find((f) => f.id === friendId);
  const sent = sentFor(c.id);
  const head = `<div class="row"><div class="task-icon">${taskIcon(c.id)}</div><div class="grow"><h3>${c.title}</h3><p class="muted small">${c.hint}</p></div><span class="chip${spolu ? ' group' : ''}">${spolu ? 'Spolu' : 'Jen já'}</span></div>`;
  let body;
  if (!spolu) {
    body = `<button class="btn" data-a="complete" data-cat="${c.id}">Zapsat chvilku</button>
      <button class="btn ghost small-btn" data-a="mode" data-cat="${c.id}" data-v="spolu">${ICON.tab.pratele('#3F4E16').replace('width="24" height="24"', 'width="18" height="18"')}<span style="margin-left:6px">Přizvat kamaráda</span></button>`;
  } else if (!friends.length) {
    body = `<p class="small muted">Zatím tu nemáš žádné kamarády. Pozvat je můžeš v záložce Přátelé.</p>
      <button class="btn ghost" data-a="mode" data-cat="${c.id}" data-v="sam">Zpět</button>`;
  } else if (!sent) {
    body = `<p class="small green-text">Koho přizveš? Kamarád může jedním klepnutím říct „teď ne“, bez vysvětlování.</p>
      <div class="pills">${friends.map((f) => `<button type="button" class="pill" aria-pressed="${f.id === friendId}" data-a="pickFriend" data-cat="${c.id}" data-id="${esc(f.id)}">${esc(f.jmeno)}</button>`).join('')}</div>
      <div class="btn-row"><button class="btn ghost" data-a="mode" data-cat="${c.id}" data-v="sam">Zrušit</button><button class="btn" data-a="inviteFor" data-cat="${c.id}">Přizvat: ${esc(friend?.jmeno)}</button></div>`;
  } else if (sent.prijato) {
    body = `<p class="small green-text" style="font-weight:600">${esc(friend?.jmeno)} se přidá. Užijte si to spolu.</p>
      <button class="btn" data-a="complete" data-cat="${c.id}" data-joint="1">Zapsat společnou chvilku</button>`;
  } else {
    body = `<p class="small green-text">Pozvánka odeslána (${esc(friend?.jmeno)}). Odpověď uvidíš tady.</p>
      <div class="btn-row"><button class="btn ghost" data-a="mode" data-cat="${c.id}" data-v="sam">Zrušit</button><button class="btn" data-a="complete" data-cat="${c.id}">Zapsat i bez kamaráda</button></div>`;
  }
  // Po splnění se karta vrátí do původní podoby, ať jde chvilku kdykoli zapsat znovu.
  return `<section class="card${S.justDone === c.id ? ' just-done' : ''}">${head}<div class="stack">${body}</div></section>`;
}

/** Věta do okénka Skvělá práce: kam se chvilka započítala (jen společný součet). */
function challengeNote(res) {
  const ids = res?.zapocitanoDoCilu || [];
  if (!ids.length) return '';
  for (const g of S.groups) for (const c of g.cile || []) {
    if (ids.includes(c.goalId) && c.reached && c.together === c.target) return `Společná výzva skupiny ${g.nazev} je splněná! Spolu jste to dali.`;
  }
  const g = S.groups.find((x) => (x.cile || []).some((c) => ids.includes(c.goalId)));
  return g ? `Započítáno do společné výzvy skupiny ${g.nazev}.` : 'Započítáno do společné výzvy.';
}

/** Všechny společné výzvy, které tahle chvilka může naplnit (jen když to člověk nevypnul). */
function matchingChallengeIds(cat) {
  if (!autoChallenge()) return [];
  const ids = [];
  for (const g of S.groups) for (const c of g.cile || []) if (c.category === cat) ids.push(c.goalId);
  return ids;
}
function autoChallenge() { return store.get('os-auto-challenge') !== '0'; }

// Cíl tohoto týdne pro jednoho. Jakmile si s kamarády dáte společnou výzvu, ukáže se na jeho místě ta.
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
      <button class="btn ghost small-btn" data-a="weeklyOpen">Upravit můj cíl</button>
      <button class="btn ghost small-btn" data-a="goToGoal">Nastavit společnou výzvu s kamarády</button>
    </section>`;
  }
  return `<section class="card"><p class="label">Cíl tohoto týdne</p><h2>Dej si cíl na tento týden</h2>
    <p class="muted">Třeba 5 chvilek pro sebe nebo 3 procházky. Když se to nepovede, nic se neděje.</p>
    <button class="btn" data-a="weeklyOpen">Nastavit můj cíl</button>
    <button class="btn ghost" data-a="goToGoal">Nastavit společnou výzvu s kamarády</button>
  </section>`;
}

// Vlastní chvilka: jen pro sebe (název vidí jen autor), splní se jedním klepnutím.
function customCard(c) {
  const j = CAT.JINE;
  return `<section class="card${S.justDone === c.id ? ' just-done' : ''}">
    <div class="row"><div class="task-icon">${taskIcon('JINE')}</div><div class="grow"><h3>${esc(c.nazev)}</h3><p class="muted small">Tvoje vlastní chvilka</p></div><span class="chip">Jen já</span></div>
    <div class="btn-row"><button class="btn ghost" data-a="removeCustom" data-id="${esc(c.id)}" aria-label="Odebrat chvilku ${esc(c.nazev)}">Odebrat</button><button class="btn" data-a="completeCustom" data-id="${esc(c.id)}">Zapsat chvilku</button></div>
  </section>`;
}

function customCreateCard() {
  return `<section class="card tint">
    <div><h3>Vlastní chvilka</h3><p class="green-text small">Napiš, při čem si nejlíp odpočineš, třeba „Koupel“ nebo „Hra s kočkou“. Objeví se tu jako další karta. Název uvidíš jen ty.</p></div>
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
    <div><h1>Přátelé</h1><p class="muted">Jen lidé, které si sem pozveš.</p></div>
    <div class="two-col"><div class="col">
    <section class="card tint">
      <div class="stack" style="gap:6px"><h2>Pozvi kamaráda</h2><p class="green-text small" style="line-height:1.5">Pošli mu odkaz. Jakmile ho přijme, jste přátelé a můžete spolu odpočívat a navzájem se podporovat.</p></div>
      ${S.inviteLink
        ? `<div class="field"><label for="f-link">Platí 3 dny pro jednoho člověka</label><input id="f-link" readonly value="${esc(S.inviteLink)}"></div>
           <div class="btn-row"><button class="btn" data-a="copyLink">Zkopírovat</button>${navigator.share ? '<button class="btn ghost" data-a="shareLink">Poslat…</button>' : ''}</div>`
        : `<button class="btn big" data-a="createInvite">Vytvořit odkaz</button>`}
    </section>
    ${goalSection(group, friends)}
    </div><div class="col">
    ${pending.map((f) => `<section class="card"><div class="row"><div class="avatar">${esc(f.jmeno.charAt(0))}</div><div class="grow"><h3>${esc(f.jmeno)}</h3><p class="muted small">Chce se s tebou spřátelit.</p></div></div>
      <div class="btn-row"><button class="btn ghost" data-a="removeFriend" data-id="${esc(f.id)}">Teď ne</button><button class="btn" data-a="confirmFriend" data-id="${esc(f.id)}">Potvrdit</button></div></section>`).join('')}
    ${S.groupInvites.map((g) => `<section class="card"><p class="label">${esc(g.odKoho)} tě zve do skupiny</p><h3>${esc(g.skupina)}</h3>
      <div class="btn-row"><button class="btn ghost" data-a="answerGroup" data-id="${esc(g.id)}" data-v="0">Teď ne</button><button class="btn" data-a="answerGroup" data-id="${esc(g.id)}" data-v="1">Přidat se</button></div></section>`).join('')}
    ${S.pings.slice(0, 3).map((p) => `<section class="card"><div class="row"><div class="avatar warm">${esc(p.odKoho.charAt(0))}</div><div class="grow"><h3>Povzbuzení od: ${esc(p.odKoho)}</h3><p class="muted small">„${esc(p.text)}“</p></div></div></section>`).join('')}
    <h2 style="margin-top:6px">Povzbuď kamaráda</h2>
    ${friends.length ? '' : '<p class="muted">Až budeš mít kamarády, uvidíš je tady.</p>'}
    ${friends.map((f) => `<section class="card">
      <div class="row"><div class="avatar">${esc(f.jmeno.charAt(0))}</div><h3 class="grow">${esc(f.jmeno)}</h3>
        <button class="icon-btn soft" aria-label="Možnosti pro ${esc(f.jmeno)}" aria-expanded="${S.menuFor === f.id}" data-a="menu" data-id="${esc(f.id)}">${ICON.dots}</button></div>
      ${S.pinged[f.id]
        ? `<p class="small green-text" style="font-weight:600">Odesláno.</p>`
        : `<div class="btn-row"><button class="btn ghost small-btn" data-a="ping" data-id="${esc(f.id)}" data-v="MYSLIM_NA_TEBE">Myslím na tebe</button><button class="btn ghost small-btn" data-a="ping" data-id="${esc(f.id)}" data-v="DEJ_SI_PAUZU">Dej si pauzu</button></div>`}
      ${S.menuFor === f.id ? `<div class="stack">
        ${group && !api.demo ? `<button class="btn soft small-btn" data-a="inviteToGroup" data-id="${esc(f.id)}">Pozvat do skupiny ${esc(group.nazev)}</button>` : ''}
        <div class="btn-row"><button class="btn soft small-btn" data-a="block" data-id="${esc(f.id)}">Zablokovat</button><button class="btn soft small-btn" data-a="report" data-id="${esc(f.id)}">Nahlásit</button></div>
        <button class="btn soft small-btn" data-a="removeFriend" data-id="${esc(f.id)}">Odebrat z přátel</button></div>` : ''}
    </section>`).join('')}
    ${waiting.length ? `<p class="muted small">Čeká na potvrzení: ${waiting.map((w) => esc(w.jmeno)).join(', ')}</p>` : ''}
    <h2 style="margin-top:6px">Co kamarádi nasdíleli</h2>
    ${S.feed.length ? S.feed.map((e) => `<div class="feed-item"><p><b>${esc(e.authorName)}</b> · ${esc(e.label)}</p><span class="small muted">${e.day === todayStr() ? 'dnes' : esc(new Date(e.day + 'T12:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }))}</span></div>`).join('') : '<p class="muted">Zatím nic. Až kamarádi něco nasdílí, uvidíš to tady.</p>'}
    </div></div>
  </div>`;
}

// Společná výzva týdne: založit skupinu, přidat výzvu a plnit ji. Jen společný součet, nic po lidech.
function goalSection(group, friends) {
  if (!group) {
    return `<section class="card" id="cil"><p class="label">Společná výzva týdne</p><h2>Založte si skupinu</h2>
      <p class="muted small">Dejte si cíl na týden, třeba 10 procházek. Každý odpočívá, kdy chce, a počítá se to dohromady.</p>
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
      <div class="row"><div class="task-icon">${taskIcon(g.category)}</div><div class="grow"><h3>${esc(c.title || g.category)}</h3><p class="small${g.reached ? ' green-text' : ' muted'}" style="font-weight:600">${esc(g.text)}</p></div></div>
      <div class="bar" role="img" aria-label="${esc(g.text)}"><span style="width:${Math.max(pct, 3)}%"></span></div>
      <button class="btn${g.reached ? ' ghost' : ''}" data-a="goalDo" data-id="${esc(g.goalId)}" data-cat="${esc(g.category)}">${g.reached ? 'Zapsat další chvilku' : 'Zapsat chvilku do výzvy'}</button>
    </div>`;
  };
  const form = S.goalForm && free.length
    ? `<div class="stack goal-form">
        <p style="font-weight:600">Na čem bude výzva?</p>
        <div class="pills">${free.map((c) => `<button type="button" class="pill" aria-pressed="${c.id === cat}" data-a="goalCat" data-v="${c.id}">${esc(c.title)}</button>`).join('')}</div>
        <p style="font-weight:600">Kolik chvilek dohromady?</p>
        <div class="row stepper"><button type="button" class="icon-btn soft" aria-label="Méně" data-a="goalTarget" data-v="-1">−</button>
          <span class="stepper-value" aria-live="polite">${S.goalTarget}</span>
          <button type="button" class="icon-btn soft" aria-label="Více" data-a="goalTarget" data-v="1">+</button>
          <span class="muted small grow">${esc(CAT[cat]?.gen || '')} dohromady</span></div>
        <div class="btn-row"><button class="btn ghost" data-a="goalCancel">Zrušit</button><button class="btn" data-a="goalCreate" data-v="${cat}">Přidat výzvu</button></div>
      </div>`
    : free.length ? `<button class="btn ghost" data-a="goalOpen">+ Přidat výzvu na tento týden</button>` : '';
  return `<section class="card" id="cil">
    <div class="row between"><div><p class="label">Společná výzva týdne</p><h2>${esc(group.nazev)}</h2></div><span class="chip group">Skupina</span></div>
    <p class="muted small">${(group.clenove || []).map((m) => esc(m.jmeno)).join(', ')}</p>
    ${reachedCount ? `<p class="small green-text" style="font-weight:600">Společně splněné výzvy tento týden: ${reachedCount}. Krása!</p>` : ''}
    ${goals.length ? goals.map(goalCard).join('') : (S.goalForm || reachedCount ? '' : '<p class="muted">Tento týden zatím žádná výzva.</p>')}
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

// Ručně kreslené návrhy květin (web/kvetiny/*.svg -> flowers.js). Plátno 960×960, rostlina stojí v (480, 805).
// Měřítko = jak velká je rostlina v zahradě. Druhy bez návrhu se kreslí jednoduchými tvary níže.
const FLOWER_SCALE = { tulip: 0.085, daisy: 0.085, sunflower: 0.1, lavender: 0.095, tree: 0.18, dot: 0.058 };
// Barevné varianty: barva rostliny v zahradě -> návrh dané varianty (např. tulipan-zluty-*.svg).
const FLOWER_VARIANT = {
  tulip: { '#F2C94C': 'zluty' },
  sunflower: { '#F2994A': 'oranzova' },
  lavender: { '#9B8FD1': 'modra' },
  dot: { '#F2C94C': 'zluty', '#F6E7A1': 'zluty', '#B48ACB': 'fialovy', '#FFFFFF': 'bily' },
};
function designedPlant(p, stage) {
  const variant = FLOWER_VARIANT[p.kind]?.[p.color];
  const art = (variant && window.FLOWER_ART?.[`${p.kind}:${variant}`]?.[stage - 1]) || window.FLOWER_ART?.[p.kind]?.[stage - 1];
  if (!art) return '';
  const k = FLOWER_SCALE[p.kind] || 0.08;
  return `<g transform="translate(${p.x} ${p.y}) scale(${k}) translate(-480 -805)">${art}</g>`;
}

function gardenPlant(p, stage) {
  const designed = designedPlant(p, stage);
  if (designed) return designed;
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
// ---------- krajina zahrady (plochý vektorový styl: vrstvené kopce, dvoubarevné mraky) ----------
// Souřadnice: celé SVG 390×760; krajina je ve skupině posunuté o 360 dolů (0–400).
// Rostliny stojí od y≈222 níž, kopce jsou tvarované tak, aby na nich seděly.
const INK = '#2B3A4A';

/** Mrak s rovným spodkem a stínem na pravé straně (jako na referenční ilustraci). */
function cloud(x, y, w, light, shade) {
  const h = w * 0.42;
  const body = `M${x} ${y} H${x + w} C${x + w + 2} ${y - h * 0.38} ${x + w * 0.86} ${y - h * 0.62} ${x + w * 0.72} ${y - h * 0.5}
    C${x + w * 0.66} ${y - h * 1.08} ${x + w * 0.3} ${y - h * 1.1} ${x + w * 0.32} ${y - h * 0.55}
    C${x + w * 0.16} ${y - h * 0.72} ${x - 2} ${y - h * 0.4} ${x} ${y} Z`;
  const shadow = `M${x + w * 0.5} ${y} H${x + w} C${x + w + 2} ${y - h * 0.38} ${x + w * 0.86} ${y - h * 0.62} ${x + w * 0.72} ${y - h * 0.5}
    C${x + w * 0.74} ${y - h * 0.22} ${x + w * 0.62} ${y - h * 0.06} ${x + w * 0.5} ${y} Z`;
  return `<path d="${body}" fill="${light}"/><path d="${shadow}" fill="${shade}"/>`;
}
const birdsAt = (pts, color = INK) => pts.map(([x, y, k]) => `<path d="M${x} ${y} q${5 * k} ${-6 * k} ${10 * k} ${-1 * k} q${5 * k} ${-5 * k} ${10 * k} ${1 * k}" fill="none" stroke="${color}" stroke-width="${2.2 * k}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');

/** Kopec s jemně světlejším hřebenem (stejná křivka posunutá o pár bodů výš). */
function hill(d, fill, rim) {
  return `${rim ? `<path d="${d}" fill="${rim}" transform="translate(0 -3.5)"/>` : ''}<path d="${d}" fill="${fill}"/>`;
}
const H = {
  far1: 'M0 150 C50 124 110 118 176 136 C238 152 300 116 390 124 V400 H0 Z',
  far2: 'M0 166 C64 146 140 148 206 160 C276 172 326 144 390 148 V400 H0 Z',
  far3: 'M0 182 C76 166 144 170 204 178 C270 188 330 166 390 170 V400 H0 Z',
  mid: 'M0 198 C56 178 118 180 168 192 C228 206 300 178 390 188 V400 H0 Z',
  back: 'M0 214 C80 196 160 200 230 212 C300 224 350 206 390 204 V400 H0 Z',
  front: 'M0 238 C90 222 170 228 250 238 C320 246 360 234 390 232 V400 H0 Z',
  fore: 'M0 300 C90 288 200 294 280 300 C330 304 370 298 390 296 V400 H0 Z',
};

/** Stromeček „lízátko“ s kmínkem a větvičkami (jako na referenční krajině). */
function lolli(x, y, r, crown, hi, trunk = '#6B5A45') {
  return `<path d="M${x} ${y} V${y - r * 1.9}" stroke="${trunk}" stroke-width="${Math.max(1.6, r * 0.18)}" stroke-linecap="round"/>
    <path d="M${x} ${y - r * 1.1} l${-r * 0.45} ${-r * 0.45} M${x} ${y - r * 1.35} l${r * 0.42} ${-r * 0.4}" stroke="${trunk}" stroke-width="${Math.max(1.2, r * 0.12)}" stroke-linecap="round"/>
    <circle cx="${x}" cy="${y - r * 2}" r="${r}" fill="${crown}"/>
    <path d="M${x - r} ${y - r * 2} A${r} ${r} 0 0 1 ${x + r * 0.2} ${y - r * 2.98} A${r * 1.1} ${r * 1.1} 0 0 0 ${x - r} ${y - r * 2} Z" fill="${hi}"/>
    <path d="M${x - r * 0.7} ${y - r * 2.1} l${r * 0.7} ${r * 0.55} l${r * 0.55} ${-r * 0.6} M${x} ${y - r * 1.55} V${y - r * 2.5}" stroke="${trunk}" stroke-width="${Math.max(1, r * 0.08)}" stroke-linecap="round" fill="none" opacity="0.6"/>`;
}
/** Jehličnan z několika zaoblených pater. */
function pine(x, y, h, c1, c2) {
  const w = h * 0.42;
  let s = `<path d="M${x} ${y} V${y - h * 0.18}" stroke="#5B4A38" stroke-width="${h * 0.06}" stroke-linecap="round"/>`;
  for (let i = 0; i < 3; i++) {
    const top = y - h * (0.55 + i * 0.2), base = y - h * (0.14 + i * 0.22), ww = w * (1 - i * 0.24);
    s += `<path d="M${x} ${top - h * 0.12} C${x + ww * 0.3} ${top} ${x + ww * 0.8} ${base - h * 0.08} ${x + ww} ${base} Q${x} ${base + h * 0.06} ${x - ww} ${base} C${x - ww * 0.8} ${base - h * 0.08} ${x - ww * 0.3} ${top} ${x} ${top - h * 0.12} Z" fill="${i % 2 ? c2 : c1}"/>`;
    s += `<path d="M${x} ${top - h * 0.12} C${x + ww * 0.3} ${top} ${x + ww * 0.8} ${base - h * 0.08} ${x + ww} ${base} Q${x + ww * 0.5} ${base + h * 0.04} ${x} ${base + h * 0.03} Z" fill="#000" opacity="0.12"/>`;
  }
  return s;
}
/** Keřík s květy (vrstvené kruhy, tečky jako na referenci). */
function bush(x, y, r, c1, c2, dots) {
  return `<circle cx="${x - r * 0.7}" cy="${y - r * 0.5}" r="${r * 0.75}" fill="${c2}"/><circle cx="${x + r * 0.6}" cy="${y - r * 0.45}" r="${r * 0.7}" fill="${c2}"/>
    <circle cx="${x}" cy="${y - r * 0.8}" r="${r}" fill="${c1}"/>
    <path d="M${x - r} ${y - r * 0.8} A${r} ${r} 0 0 1 ${x + r * 0.1} ${y - r * 1.8} A${r * 1.1} ${r * 1.1} 0 0 0 ${x - r} ${y - r * 0.8} Z" fill="#FFFFFF" opacity="0.18"/>
    ${dots ? [[-0.5, -1.1], [0.3, -1.3], [0.6, -0.7], [-0.2, -0.6], [-0.9, -0.4]].map(([a, b]) => `<circle cx="${x + a * r}" cy="${y + b * r}" r="${r * 0.1}" fill="${dots}"/>`).join('') : ''}`;
}
function appleTree(x, y, k) {
  return `<path d="M${x - 3 * k} ${y} C${x - 2 * k} ${y - 14 * k} ${x - 2 * k} ${y - 24 * k} ${x - 1.5 * k} ${y - 32 * k} L${x + 1.5 * k} ${y - 32 * k} C${x + 2 * k} ${y - 24 * k} ${x + 2 * k} ${y - 14 * k} ${x + 3 * k} ${y} Z" fill="#7A5A40"/>
    <circle cx="${x}" cy="${y - 44 * k}" r="${20 * k}" fill="#5E8A4E"/><circle cx="${x - 12 * k}" cy="${y - 36 * k}" r="${12 * k}" fill="#7EA65A"/><circle cx="${x + 12 * k}" cy="${y - 37 * k}" r="${11 * k}" fill="#4F7B57"/>
    <path d="M${x - 20 * k} ${y - 44 * k} A${20 * k} ${20 * k} 0 0 1 ${x + 4 * k} ${y - 64 * k} A${22 * k} ${22 * k} 0 0 0 ${x - 20 * k} ${y - 44 * k} Z" fill="#A3C474"/>
    ${[[-8, -50], [7, -44], [-2, -36], [12, -54], [-14, -40]].map(([a, b]) => `<circle cx="${x + a * k}" cy="${y + b * k}" r="${2.6 * k}" fill="#E8665A"/>`).join('')}`;
}
/** Domeček: dvoubarevné zdi, taška na střeše, okna s rámem a truhlíkem, dveře, komín s kouřem. */
function cottage(cx, base) {
  const w = 66, wall = 40, l = cx - w / 2, r = cx + w / 2, top = base - wall, ridge = top - 30;
  return `<g>
    <rect x="${r - 16}" y="${ridge + 4}" width="9" height="22" fill="#B86452"/><rect x="${r - 17.5}" y="${ridge + 1}" width="12" height="5" rx="1.5" fill="#9E5444"/>
    <circle cx="${r - 10}" cy="${ridge - 6}" r="5" fill="#FFFFFF" opacity="0.85"/><circle cx="${r - 4}" cy="${ridge - 16}" r="6.5" fill="#FFFFFF" opacity="0.65"/><circle cx="${r + 4}" cy="${ridge - 28}" r="8" fill="#FFFFFF" opacity="0.45"/>
    <rect x="${l}" y="${top}" width="${w}" height="${wall}" fill="#FBF1DE"/>
    <rect x="${cx}" y="${top}" width="${w / 2}" height="${wall}" fill="#F1E2C6"/>
    <rect x="${l}" y="${top}" width="${w}" height="5" fill="#E6D3B2"/>
    <path d="M${l - 7} ${top + 2} L${cx} ${ridge} L${r + 7} ${top + 2} Z" fill="#E9806A"/>
    <path d="M${cx} ${ridge} L${r + 7} ${top + 2} L${cx} ${top + 2} Z" fill="#D46A57"/>
    ${[0.33, 0.66].map((k) => `<path d="M${cx - (cx - l + 7) * k} ${ridge + (top + 2 - ridge) * k} H${cx + (r + 7 - cx) * k}" stroke="#C85F4D" stroke-width="1.6" opacity="0.7"/>`).join('')}
    <path d="M${l - 9} ${top + 3} L${cx} ${ridge - 2} L${r + 9} ${top + 3}" fill="none" stroke="#B85645" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${ridge + 15}" r="5" fill="#F7D36A"/><path d="M${cx} ${ridge + 10} V${ridge + 20} M${cx - 5} ${ridge + 15} H${cx + 5}" stroke="#E6D3B2" stroke-width="1.4"/>
    ${[l + 7, r - 21].map((x) => `<rect x="${x - 1.5}" y="${top + 9.5}" width="17" height="15" rx="2" fill="#E6D3B2"/><rect x="${x}" y="${top + 11}" width="14" height="12" rx="1.5" fill="#F7D36A"/>
      <path d="M${x + 7} ${top + 11} V${top + 23} M${x} ${top + 17} H${x + 14}" stroke="#E6D3B2" stroke-width="1.6"/>
      <rect x="${x - 2}" y="${top + 24}" width="18" height="4" rx="1.5" fill="#A27C56"/>
      <circle cx="${x + 2}" cy="${top + 23}" r="2.4" fill="#F49AB6"/><circle cx="${x + 7}" cy="${top + 22.5}" r="2.4" fill="#F6A58C"/><circle cx="${x + 12}" cy="${top + 23}" r="2.4" fill="#F49AB6"/>`).join('')}
    <path d="M${cx - 7} ${base} V${top + 18} a7 7 0 0 1 14 0 V${base} Z" fill="#8A6447"/><path d="M${cx} ${base} V${top + 11} a7 7 0 0 1 7 7 V${base} Z" fill="#6E4D35"/>
    <circle cx="${cx + 4}" cy="${base - 10}" r="1.3" fill="#F7D36A"/>
    <rect x="${cx - 10}" y="${base - 1}" width="20" height="3" rx="1" fill="#D9CBB0"/>
  </g>`;
}
const stars = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFF6E0"/>`).join('');

const GARDEN_LEVELS = [
  {
    name: 'Jarní louka',
    sky: ['#DDEBE3', '#EEF2E4', '#F7F1DE'],
    sky2: (t) => `<circle cx="304" cy="292" r="30" fill="#F7D36A"/>
      ${cloud(40, 300, 92, '#F6A58C', '#EE8F78')}${cloud(250, 252, 70, '#F6A58C', '#EE8F78')}${cloud(330, 340, 46, '#F8B9A3', '#F1A08A')}
      ${t >= 20 ? birdsAt([[226, 392, 1.2], [262, 372, 0.9], [196, 410, 0.7]]) : birdsAt([[240, 388, 0.9]])}`,
    far: [['#FAF1DA', '#FFFFFF'], ['#F7DCBF', '#FBE9D6'], ['#F3BFA2', '#F7D2BC']],
    hills: { mid: ['#3F6B4E', '#4F7B57'], back: ['#86A85E', '#9DBD70'], front: ['#6F9A52', '#86AD62'], fore: ['#4F7B47', null] },
    back: () => `${lolli(52, 196, 9, '#F7C9A1', '#FBDDBF')}${lolli(120, 186, 7, '#4F7B57', '#6F9A5B')}${lolli(300, 190, 8, '#F7C9A1', '#FBDDBF')}
      ${lolli(356, 186, 6, '#4F7B57', '#6F9A5B')}${lolli(212, 200, 5, '#F7C9A1', '#FBDDBF')}
      ${bush(18, 200, 9, '#3F6B4E', '#2F5B44')}${bush(166, 198, 8, '#3F6B4E', '#2F5B44')}`,
    front: () => '',
  },
  {
    name: 'Zahrada u rybníčku',
    sky: ['#D6EAEC', '#E8F1EC', '#F4F2E2'],
    sky2: (t) => `<circle cx="74" cy="282" r="28" fill="#F49AB6"/>
      ${cloud(160, 274, 96, '#F7D36A', '#EFBF45')}${cloud(300, 330, 60, '#F7D36A', '#EFBF45')}
      ${birdsAt([[250, 402, 1.1], [282, 386, 0.8]], '#3D7BB8')}${t >= 20 ? birdsAt([[120, 380, 0.8]], '#3D7BB8') : ''}`,
    far: [['#F2F0DF', '#FFFFFF'], ['#CFE2D8', '#E0EEE6'], ['#B7D3C6', '#C9E0D4']],
    hills: { mid: ['#3F6B4E', '#4F7B57'], back: ['#8DB062', '#A3C474'], front: ['#6F9A52', '#86AD62'], fore: ['#4F7B47', null] },
    back: () => `<ellipse cx="205" cy="210" rx="86" ry="17" fill="#6FAFC0"/><ellipse cx="205" cy="207" rx="80" ry="13" fill="#8CC6D2"/><ellipse cx="190" cy="205" rx="44" ry="5" fill="#B5DDE5"/>
      <path d="M160 211 h22 M214 203 h30 M236 213 h16" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
      <g><ellipse cx="172" cy="212" rx="10" ry="3.8" fill="#4F7B57"/><path d="M172 212 l10 -2 l-2 3z" fill="#8CC6D2"/><circle cx="174" cy="209" r="3" fill="#F49AB6"/><circle cx="174" cy="209" r="1.2" fill="#F7D36A"/></g>
      <g><ellipse cx="240" cy="209" rx="8" ry="3" fill="#6F9A5B"/></g>
      <g><ellipse cx="214" cy="203" rx="9" ry="5.5" fill="#FFFFFF"/><path d="M205 203 q4 -5 10 -2" fill="#E8E8DC"/><circle cx="221" cy="196" r="4.2" fill="#FFFFFF"/><path d="M225 196 l4.5 1.2 -4.5 1.4z" fill="#F2994A"/><circle cx="222" cy="195" r="0.9" fill="${INK}"/></g>
      ${[[118, 214], [124, 216], [130, 214], [282, 214], [289, 216]].map(([x, y], i) => `<path d="M${x} ${y} Q${x + (i % 2 ? 2 : -2)} ${y - 14} ${x} ${y - 26}" stroke="#4F7B47" stroke-width="2" fill="none" stroke-linecap="round"/>${i % 2 ? '' : `<rect x="${x - 2.4}" y="${y - 34}" width="4.8" height="11" rx="2.4" fill="#8A6447"/>`}`).join('')}
      ${lolli(40, 192, 9, '#F7C9A1', '#FBDDBF')}${lolli(350, 188, 8, '#4F7B57', '#6F9A5B')}${bush(320, 198, 8, '#3F6B4E', '#2F5B44', '#F49AB6')}`,
    front: () => '',
  },
  {
    name: 'Ovocný sad',
    sky: ['#F6E9CC', '#F9F0DC', '#FBF4E4'],
    sky2: (t) => `<circle cx="300" cy="310" r="30" fill="#F49AB6"/>
      ${cloud(40, 270, 90, '#F7D36A', '#EFBF45')}${cloud(220, 230, 64, '#F7D36A', '#EFBF45')}
      ${t >= 20 ? birdsAt([[150, 380, 1], [180, 366, 0.8]]) : ''}`,
    far: [['#FBF1D6', '#FFFFFF'], ['#F2D9B0', '#F8E7CA'], ['#DDCB97', '#E8D8AA']],
    hills: { mid: ['#4F7B57', '#5E8A5B'], back: ['#97B566', '#AAC679'], front: ['#7BA255', '#8FB466'], fore: ['#567F47', null] },
    back: () => `${pine(18, 196, 46, '#3F6B4E', '#4F7B57')}${pine(370, 192, 52, '#3F6B4E', '#4F7B57')}
      ${appleTree(136, 186, 0.9)}${appleTree(258, 198, 0.8)}${appleTree(336, 178, 0.95)}
      <g><path d="M0 216 L390 208" stroke="#B48A62" stroke-width="3.2" stroke-linecap="round"/><path d="M0 228 L390 220" stroke="#B48A62" stroke-width="3.2" stroke-linecap="round"/>
      ${Array.from({ length: 14 }, (_, i) => { const x = 8 + i * 29, yy = 224 - i * 0.6; return `<path d="M${x - 2.5} ${yy} V${yy - 18} l2.5 -3 l2.5 3 V${yy} Z" fill="#C79C70"/><path d="M${x} ${yy} V${yy - 21} l2.5 3 V${yy} Z" fill="#A27C56"/>`; }).join('')}</g>
      <g><rect x="294" y="196" width="46" height="6" rx="2" fill="#C79C70"/><rect x="296" y="186" width="42" height="5" rx="2" fill="#B48A62"/><path d="M299 202 V213 M335 202 V213" stroke="#8A6544" stroke-width="3" stroke-linecap="round"/></g>`,
    front: () => '',
  },
  {
    name: 'Večerní zahrada',
    sky: ['#B9A7CF', '#E9A7A6', '#F7C99F'], dusk: true,
    sky2: () => `<circle cx="250" cy="512" r="40" fill="#F49AB6"/><circle cx="250" cy="512" r="58" fill="#F49AB6" opacity="0.25"/>
      <path d="M318 244 a22 22 0 1 0 16 36 a18 18 0 1 1 -16 -36z" fill="#FFF3D6"/>
      ${stars([[40, 230, 1.6], [150, 206, 1.3], [252, 276, 1.4], [360, 226, 1.7], [202, 330, 1.2], [92, 300, 1.1], [300, 330, 1]])}
      ${cloud(36, 360, 80, '#F4B7A6', '#E89C90')}
      <path d="M0 410 Q100 448 195 420 T390 410" fill="none" stroke="#5C4A5A" stroke-width="1.6"/>
      ${[40, 95, 150, 205, 260, 315, 365].map((x, i) => { const y = [420, 433, 437, 423, 425, 430, 416][i]; return `<path d="M${x} ${y} V${y + 6}" stroke="#5C4A5A" stroke-width="1.2"/><circle cx="${x}" cy="${y + 13}" r="12" fill="#F7D36A" opacity="0.25"/><rect x="${x - 5}" y="${y + 6}" width="10" height="14" rx="4" fill="#F7D36A"/><rect x="${x - 5}" y="${y + 6}" width="5" height="14" rx="2.5" fill="#FBE59A"/>`; }).join('')}`,
    far: [['#E9B9B4', '#F2CFC6'], ['#D39FA8', '#DEB3B8'], ['#A98FAE', '#B9A2BD']],
    hills: { mid: ['#3B5A4E', '#466858'], back: ['#6F8E5E', '#7F9D6A'], front: ['#5C7C50', '#6A8A5A'], fore: ['#3F5C42', null] },
    back: () => `${lolli(60, 196, 9, '#2F4B44', '#3B5A4E')}${lolli(318, 190, 8, '#2F4B44', '#3B5A4E')}${bush(170, 198, 9, '#2F4B44', '#273F3A')}`,
    front: () => `<g class="fireflies">${[[60, 150], [120, 120], [210, 140], [300, 110], [350, 160], [180, 100], [30, 190], [260, 180]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#FFF1A8"/><circle cx="${x}" cy="${y}" r="6" fill="#FFF1A8" opacity="0.3"/>`).join('')}</g>`,
  },
  {
    name: 'Kouzelná zahrada',
    sky: ['#DCEBEF', '#EEF2E8', '#FBF2D8'],
    // Bez hor: jen jemná duha, slunce a mraky, ať scéna dýchá.
    sky2: (t) => `<g opacity="0.55" fill="none" stroke-width="8" stroke-linecap="round">${['#F6A58C', '#F7D36A', '#A9C97A', '#8CC6D2', '#B79BDD'].map((c, i) => `<path d="M${40 + i * 8} 560 A${155 - i * 8} ${155 - i * 8} 0 0 1 ${350 - i * 8} 560" stroke="${c}"/>`).join('')}</g>
      <circle cx="318" cy="300" r="28" fill="#F49AB6"/>
      ${cloud(26, 330, 84, '#F7D36A', '#EFBF45')}${cloud(250, 262, 66, '#F7D36A', '#EFBF45')}
      ${birdsAt([[150, 400, 1], [176, 386, 0.8]], '#3D7BB8')}${t >= 20 ? birdsAt([[110, 420, 0.8]], '#3D7BB8') : ''}`,
    far: [['#E3EEE4', '#F4F8F2'], ['#CFE2C4', '#DDEBD3'], ['#B3D09E', '#C4DCAE']],
    hills: { mid: ['#3F6B4E', '#4F7B57'], back: ['#8DB062', '#A3C474'], front: ['#6F9A52', '#86AD62'], fore: ['#4F7B47', null] },
    back: () => `${pine(20, 198, 50, '#3F6B4E', '#4F7B57')}${pine(50, 196, 36, '#5E8A5B', '#6F9A5B')}${lolli(250, 198, 8, '#F7C9A1', '#FBDDBF')}
      ${cottage(318, 200)}
      ${bush(282, 202, 9, '#4F7B57', '#3F6B4E', '#F49AB6')}${bush(360, 204, 10, '#3F6B4E', '#2F5B44', '#F7D36A')}${bush(200, 202, 7, '#4F7B57', '#3F6B4E', '#F49AB6')}`,
    front: () => '',
  },
];

function gardenLevel(level) { return GARDEN_LEVELS[Math.max(0, Math.min(GARDEN_LEVELS.length, level || 1) - 1)]; }

/** Motýl ve stylu ilustrací (dvě dvoubarevná křídla). */
function butterfly(x, y, c) {
  return `<g class="butterfly"><path d="M${x} ${y} C${x - 12} ${y - 14} ${x - 16} ${y - 2} ${x - 6} ${y + 4} Z" fill="${c}"/><path d="M${x} ${y} C${x + 12} ${y - 14} ${x + 16} ${y - 2} ${x + 6} ${y + 4} Z" fill="${c}" opacity="0.8"/>
    <path d="M${x} ${y} C${x - 8} ${y + 2} ${x - 8} ${y + 10} ${x - 2} ${y + 9} Z" fill="#F7D36A"/><path d="M${x} ${y} C${x + 8} ${y + 2} ${x + 8} ${y + 10} ${x + 2} ${y + 9} Z" fill="#F7D36A" opacity="0.8"/>
    <path d="M${x} ${y - 5} V${y + 8}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/></g>`;
}

function gardenScene(total, grewIndex, level = 1, crop = false) {
  const L = gardenLevel(level);
  const { items, butterflies } = gardenItems(total);
  items.sort((a, b) => a.p.y - b.p.y);
  const label = `${L.name}. ${items.length ? `${items.length} ${items.length === 1 ? 'rostlina' : items.length < 5 ? 'rostliny' : 'rostlin'}` : 'Zatím jen krajina, první chvilka zasadí semínko'}`;
  const h = L.hills;
  // crop = výřez jen s krajinou a rostlinami (pro menší ilustrace, třeba u sdílení)
  return `<svg class="big-garden${L.dusk ? ' dusk' : ''}" viewBox="${crop ? '0 380 390 300' : '0 0 390 760'}" preserveAspectRatio="${crop ? 'xMidYMid' : 'xMidYMax'} slice" role="img" aria-label="Tvoje zahrada: ${label}">
    <defs><linearGradient id="sky-${level}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.sky[0]}"/><stop offset="0.45" stop-color="${L.sky[1]}"/><stop offset="0.75" stop-color="${L.sky[2]}"/></linearGradient></defs>
    <rect width="390" height="760" fill="url(#sky-${level})"/>
    ${L.sky2(total)}
    <g transform="translate(0 360)">
      ${hill(H.far1, L.far[0][0], L.far[0][1])}${hill(H.far2, L.far[1][0], L.far[1][1])}${hill(H.far3, L.far[2][0], L.far[2][1])}
      ${hill(H.mid, h.mid[0], h.mid[1])}
      ${L.back(total)}
      ${hill(H.back, h.back[0], h.back[1])}
      ${hill(H.front, h.front[0], h.front[1])}
      <path d="${H.fore}" fill="${h.fore[0]}" opacity="0.45"/>
      ${items.map(({ p, i, stage, small }) => {
        const plant = `<g class="gp${i === grewIndex ? ' grew' : ''}" style="transform-origin:${p.x}px ${p.y}px">${gardenPlant(p, stage)}</g>`;
        return small ? `<g transform="translate(${p.x} ${p.y}) scale(0.7) translate(${-p.x} ${-p.y})">${plant}</g>` : plant;
      }).join('')}
      ${L.front(total)}
    </g>
    ${Array.from({ length: butterflies }, (_, b) => { const x = 60 + seeded(b + 500) * 270; const y = 420 + seeded(b + 700) * 120;
      return butterfly(x, y, ['#F49AB6', '#8CC6D2', '#B79BDD', '#F6A58C', '#F7D36A'][b % 5]); }).join('')}
  </svg>`;
}

function gardenView() {
  const g = S.game || {};
  if (!g.hraZapnuta) {
    return `<div class="screen"><div><h1>Tvoje zahrada</h1></div><section class="card"><p class="green-text">Zahradu a úrovně máš vypnuté. Zahrada na tebe počká přesně taková, jaká je. Zapnout je můžeš v záložce Já.</p></section></div>`;
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
      <section class="card glass garden-levels"><h3>Podoby zahrady</h3>
        <p class="muted small">S každou chvilkou zahrada rozkvétá. S novou úrovní se zahrada promění, rostliny zůstávají.</p>
        ${GARDEN_LEVELS.map((L, i) => { const n = i + 1; const now = Math.min(g.uroven, GARDEN_LEVELS.length) === n; const open = g.uroven >= n;
          return `<div class="row level-row${now ? ' now' : ''}"><div class="level-thumb">${open ? gardenScene(total, -1, n, true) : ''}</div>
            <div class="grow"><p style="font-weight:600">${esc(L.name)}</p><p class="muted small">${now ? 'Tvoje zahrada teď' : open ? 'Tuhle podobu už máš za sebou' : `Od úrovně ${n}`}</p></div>${now ? '<span class="chip group">Teď</span>' : ''}</div>`; }).join('')}
      </section>
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
    <div class="row"><div class="avatar" style="width:56px;height:56px;font-size:22px">${esc(name.charAt(0))}</div><div><h1 style="font-size:24px">${esc(name)}</h1><p class="muted small">Přezdívku vidí jen tví přátelé.</p></div></div>
    <div class="two-col"><div class="col">
    <button class="card" style="text-align:left;border:none;cursor:pointer;flex-direction:row;align-items:center;justify-content:space-between" data-a="openMood">
      <span><b>Jak se dnes máš?</b><br><span class="muted small">Záznam nálady vidíš jen ty</span></span>${ICON.chevron}</button>
    <section class="card" style="padding:6px 18px;gap:0">
      ${toggle('gameEnabled', 'Zahrada a úrovně', 'Když vypneš, nikdo to neuvidí')}
      ${toggle('quietHoursEnabled', `Noční klid ${esc(st.quietStart || '22:00')}–${esc(st.quietEnd || '08:00')}`, 'V noci žádné notifikace')}
      ${toggle('receivePings', 'Přijímat povzbuzení', 'Když vypneš, odesílatel se to nedozví')}
      ${toggle('receiveRestInvites', 'Přijímat pozvánky k odpočinku', 'Když vypneš, odesílatel se to nedozví')}
      <div class="setting"><div class="grow"><p style="font-weight:600">Započítávat chvilky do společné výzvy</p><p class="muted small">Skupina vidí jen společný součet, nikdy kdo co udělal</p></div>
        <button type="button" class="switch" role="switch" aria-checked="${autoChallenge()}" aria-label="Započítávat chvilky do společné výzvy" data-a="toggleAutoChallenge"><span></span></button></div>
    </section>
    </div><div class="col">
    <section class="card"><h3>Moje chvilky</h3><p class="muted small">Každou chvilku vidíš nejdřív jen ty. Sdílet ji můžeš, až uvidíš náhled.</p>
      ${recent.length ? recent.map((m) => `<div class="row between"><div class="grow"><p style="font-size:14px;font-weight:600">${esc(m.customActivityId ? m.label : CAT[m.category]?.title || m.label)}</p><p class="muted small">${m.day === todayStr() ? 'dnes' : esc(m.day)}</p></div>
        <span class="chip${m.visibility === 'JEN_JA' ? '' : ' group'}">${m.visibility === 'JEN_JA' ? 'Jen já' : m.visibility === 'PRATELE' ? 'Přátelé' : 'Skupina'}</span>
        ${m.visibility === 'JEN_JA' ? `<button class="btn ghost small-btn" data-a="openShare" data-id="${esc(m.id)}">Sdílet</button>` : `<button class="btn ghost small-btn" data-a="unshare" data-id="${esc(m.id)}">Zrušit sdílení</button>`}</div>`).join('') : '<p class="muted small">Zatím žádné.</p>'}
    </section>
    <section class="card"><h3>Moje data</h3>
      <button class="btn soft" data-a="export">Stáhnout moje data</button>
      <button class="btn soft" data-a="logout">Odhlásit se</button>
      ${S.confirmDelete
        ? `<p class="small">Smazání je nevratné: zmizí chvilky, nálada, zahrada i přátelství.</p><div class="btn-row"><button class="btn ghost" data-a="cancelDelete">Nechat účet</button><button class="btn dark" data-a="deleteAccount">Smazat natrvalo</button></div>`
        : `<button class="btn soft" data-a="askDelete">Smazat účet</button>`}
    </section>
    </div></div>
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
  // Nahoře tvoje vlastní zahrada (stejná jako v záložce Zahrada), jinak obecná ilustrace.
  const g = S.game || {};
  const art = g.hraZapnuta
    ? gardenScene(Object.values(g.zahrada || {}).reduce((x, y) => x + y, 0), -1, g.uroven, true)
    : gardenHero();
  return `<div class="sheet-wrap">
    <div class="sheet-top"><div class="only-narrow">${art}</div><div class="only-wide">${g.hraZapnuta ? gardenScene(Object.values(g.zahrada || {}).reduce((x, y) => x + y, 0), -1, g.uroven) : gardenHero()}</div><button class="btn ghost small-btn" style="background:rgba(255,255,255,.92);border:none" data-a="closeOverlay">Zpět</button></div>
    <section class="sheet" aria-label="Náhled sdílení">
      <div class="handle"></div>
      <h1 style="font-size:22px">S kým chvilku sdílet?</h1>
      <div class="pills"><button class="pill" aria-pressed="${S.shareTarget === 'PRATELE'}" data-a="shareTarget" data-v="PRATELE">Přátelé</button>
        ${group ? `<button class="pill" aria-pressed="${S.shareTarget === 'CHILL_CREW'}" data-a="shareTarget" data-v="CHILL_CREW">Skupina ${esc(group.nazev)}</button>` : ''}</div>
      ${p ? `<h2>Takhle to uvidí ostatní</h2><p class="muted">${esc(p.publikum)}</p>
        <div class="card tint" style="padding:16px;flex-direction:row;align-items:center"><div class="avatar" style="background:#fff">${esc((p.nahled?.authorName || '').charAt(0))}</div>
          <div class="grow"><p style="font-weight:600">${esc(p.nahled?.authorName)} · ${esc(p.nahled?.label)}</p><p class="green-text small">${p.nahled?.day === todayStr() ? 'dnes' : esc(p.nahled?.day)}</p></div>
          <span class="chip" style="background:#fff">${S.shareTarget === 'PRATELE' ? 'Přátelé' : 'Skupina'}</span></div>
        <p class="green-text small">✓ Jen druh chvilky a den · ✓ Nálada se nikdy nesdílí · ✓ Sdílení jde kdykoli zrušit</p>
        <button class="btn big" data-a="doShare">Sdílet</button>` : '<p class="muted">Vyber, kdo ji má vidět. Pak ti ukážeme, jak přesně to uvidí.</p>'}
      <button class="btn ghost big" data-a="closeOverlay">Nechat jen pro mě</button>
    </section>
  </div>`;
}

function inviteAcceptView() {
  const p = S.invitePreview || {};
  return `<div class="screen" style="padding-bottom:28px">
    <div style="margin:-24px -20px 0;height:200px;position:relative;overflow:hidden;background:var(--tint)">${gardenHero()}</div>
    ${p.error ? `<h1>Pozvánka už neplatí</h1><p class="muted">Požádej kamaráda o nový odkaz.</p><button class="btn big" data-a="closeInvite">Pokračovat</button>`
      : `<h1>${esc(p.odKoho || '')} tě zve mezi přátele</h1><p class="muted">Když přijmeš, budete hned přátelé. Navzájem uvidíte jen to, co si sami nasdílíte.</p>
         <div class="btn-row"><button class="btn ghost big" data-a="closeInvite">Teď ne</button><button class="btn big" data-a="acceptInvite">Přijmout</button></div>`}
  </div>`;
}

function toastView() {
  return S.toast ? `<div class="toast" role="status"><p>${esc(S.toast)}</p><button aria-label="Zavřít oznámení" data-a="closeToast">×</button></div>` : '';
}

// Na počítači (od 1024 px) je místo spodní lišty boční navigace, jako u desktopových aplikací.
function sidebar() {
  const g = S.game || {};
  const item = (id, label) => {
    const on = S.tab === id;
    return `<button class="side-item" ${on ? 'aria-current="page"' : ''} data-a="tab" data-v="${id}">${ICON.tab[id](on ? '#5F7424' : '#6B7064')}<span>${label}</span></button>`;
  };
  const total = Object.values(g.zahrada || {}).reduce((a, b) => a + b, 0);
  return `<nav class="sidebar" aria-label="Hlavní navigace">
    <div class="brand"><img src="icon.svg" alt="" width="36" height="36"><span>Odpočívat spolu</span></div>
    <div class="side-nav">${item('domu', 'Domů')}${item('pratele', 'Přátelé')}${item('zahrada', 'Zahrada')}${item('ja', 'Já')}</div>
    <button class="btn big" data-a="tab" data-v="domu">${ICON.plus.replace('width="26" height="26"', 'width="20" height="20"')}<span style="margin-left:6px">Vybrat chvilku</span></button>
    ${g.hraZapnuta && S.tab !== 'zahrada' ? `<button class="side-garden" data-a="tab" data-v="zahrada" aria-label="Moje zahrada, úroveň ${esc(g.uroven)}">
      <div class="side-garden-art">${gardenScene(total, -1, g.uroven, true)}</div>
      <div class="side-garden-text"><p style="font-weight:700">Moje zahrada</p><p class="muted small">Úroveň ${esc(g.uroven)} · ${esc(gardenLevel(g.uroven).name)}</p></div>
    </button>` : ''}
  </nav>`;
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
  toggleAutoChallenge() { store.set('os-auto-challenge', autoChallenge() ? '0' : '1'); },
  async inviteFor(d) {
    const friends = confirmedFriends();
    const fid = S.friendFor[d.cat] || friends[0]?.id;
    const res = await api.sendRestInvite(fid, d.cat);
    S.sentInvite[d.cat] = res.id;
    S.invites = await api.restInvites();
    S.toast = `Pozvánka odeslána: ${friends.find((f) => f.id === fid)?.jmeno}.`;
  },
  async complete(d) {
    const sent = d.joint ? sentFor(d.cat) : null;
    const res = await api.logMoment({
      category: d.cat,
      ...(sent?.prijato ? { restInvitationId: sent.id } : {}),
      ...(matchingChallengeIds(d.cat).length ? { goalIds: matchingChallengeIds(d.cat) } : {}),
    });
    delete S.sentInvite[d.cat];
    delete S.mode[d.cat];
    S.lastGrown = d.cat;
    await loadAll();
    celebrate(CAT[d.cat].title, d.cat, res, challengeNote(res));
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
    S.toast = 'Chvilka je odebraná. Co už je zapsané, v zahradě zůstává.';
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
    S.toast = 'Cíl na tento týden je nastavený. Chvilky, které k němu patří, se započítají samy.';
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
    S.toast = `Výzva je přidaná: ${S.goalTarget} ${CAT[d.v].gen} spolu. Každá taková chvilka se do ní započítá sama.`;
  },
  async goalDo(d) {
    const res = await api.logMoment({ category: d.cat, goalIds: [d.id] });
    S.lastGrown = d.cat;
    await loadAll();
    celebrate(CAT[d.cat].title, d.cat, res, challengeNote(res));
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
  async ping(d) { await api.sendPing(d.id, d.v); S.pinged[d.id] = true; S.game = await api.game(); S.toast = 'Povzbuzení odesláno.'; },
  async inviteToGroup(d) { await api.inviteToGroup(S.groups[0].id, d.id); S.menuFor = null; S.toast = 'Pozvánka do skupiny odeslána. Až ji kamarád přijme, uvidí vaši výzvu.'; },
  async block(d) {
    const f = S.friends.find((x) => x.id === d.id);
    await api.block(d.id);
    S.menuFor = null;
    await loadAll();
    S.toast = `Zablokováno. ${f?.jmeno || 'Kamarád'} se o tom nedozví.`;
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
      S.toast = `Hotovo, chvilka „${title}“ je mezi tvými kartami.`;
    });
  }
  if (form.dataset.form === 'group') {
    guard(async () => {
      const name = String(f.name || '').trim();
      if (!name) return;
      await api.createGroup(name);
      S.groups = await api.groups();
      S.goalForm = true; S.goalTarget = 10; S.goalCat = null;
      S.toast = 'Skupina je založená. Teď si dejte výzvu a pozvěte kamarády.';
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
  // Třída místo :has() kvůli starším prohlížečům (rozvržení s boční navigací na počítači).
  root.classList.toggle('has-sidebar', !!root.querySelector(':scope > .sidebar'));
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
