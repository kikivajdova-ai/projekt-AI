// Komunikace s backendem. Dvě implementace se STEJNÝMI metodami a odpověďmi:
//  - SupabaseApi: přihlášení přes Supabase Auth (e-mail + heslo) a volání našeho API
//    (Edge Function `api`). Aplikace nikdy nesahá na tabulky přímo.
//  - DemoApi: ukázková data jen v tomto prohlížeči, když ještě není nastavené Supabase.
(() => {
'use strict';

const CATEGORIES = [
  { id: 'PROCHAZKA', title: 'Procházka venku', hint: 'Dvacet minut na čerstvém vzduchu', plant: 'Dub', flower: '#6E8B2E', gen: 'procházek' },
  { id: 'CTENI', title: 'Čtení pro radost', hint: 'Pár stránek knihy, žádné zprávy', plant: 'Kopretina', flower: '#F2C94C', gen: 'chvilek se čtením' },
  { id: 'PAUZA', title: 'Pauza na deset minut', hint: 'Jen sedět, dýchat a nic nedělat', plant: 'Kapradí', flower: '#7FB77E', gen: 'pauz' },
  { id: 'SPANEK', title: 'Spánek navíc', hint: 'Jít dnes spát o půl hodiny dřív', plant: 'Měsíční květ', flower: '#9B8FD1', gen: 'nocí se spánkem navíc' },
  { id: 'BEZ_TELEFONU', title: 'Večer bez telefonu', hint: 'Od osmi večer odložit telefon', plant: 'Levandule', flower: '#B48ACB', gen: 'večerů bez telefonu' },
  { id: 'POHYB', title: 'Protažení', hint: 'Pár minut jógy nebo lehkého cvičení', plant: 'Šípek', flower: '#E8742A', gen: 'protažení' },
  { id: 'TVORENI', title: 'Něco vytvořit', hint: 'Kreslení, vaření, hudba, cokoli', plant: 'Slunečnice', flower: '#F2994A', gen: 'chvilek tvoření' },
  { id: 'JINE', title: 'Vlastní chvilka', hint: 'Tvoje vlastní chvilka pro sebe', plant: 'Heřmánek', flower: '#F6E7A1', gen: 'chvilek pro sebe' },
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
/** Šest připravených chvilek na domovské obrazovce; další si člověk vytvoří sám (kategorie JINE). */
const PRESETS = ['PROCHAZKA', 'CTENI', 'PAUZA', 'SPANEK', 'BEZ_TELEFONU', 'POHYB'].map((id) => CAT[id]);

class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

function newId() { return crypto.randomUUID(); }

// =====================================================================
// Skutečný backend
// =====================================================================
class SupabaseApi {
  constructor(cfg) {
    this.demo = false;
    this.apiUrl = cfg.apiUrl || `${cfg.supabaseUrl.replace(/\/$/, '')}/functions/v1/api`;
    this.anonKey = cfg.supabaseAnonKey;
    // supabase-js ukládá relaci do úložiště prohlížeče a sám obnovuje token.
    this.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  // ---- přihlášení (Supabase Auth) ----
  async session() { return (await this.sb.auth.getSession()).data.session; }
  onAuthChange(cb) { this.sb.auth.onAuthStateChange((_e, s) => cb(s)); }
  async signUp(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    // Stejná odpověď pro existující i nový e-mail: nic neprozradí, kdo aplikaci používá.
    if (error && error.status !== 422) throw new ApiError(400, 'Registrace se nepovedla. Zkontroluj e-mail a heslo (aspoň 10 znaků).');
    return { needsConfirmation: !data?.session };
  }
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (!error) return;
    if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message || '')) {
      throw new ApiError(403, 'Nejdřív potvrď svůj e-mail. Odkaz jsme ti poslali, zkontroluj i Hromadné a Spam.', 'NEPOTVRZENO');
    }
    if (error.status === 429) throw new ApiError(429, 'Moc pokusů za sebou. Zkus to prosím za pár minut.');
    throw new ApiError(401, 'Nesprávný e-mail nebo heslo.');
  }
  async resendConfirmation(email) {
    const { error } = await this.sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw new ApiError(429, 'E-mail teď nejde poslat znovu. Zkus to prosím za pár minut.');
  }
  async resetPassword(email) {
    await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  }
  async signOut() { await this.sb.auth.signOut({ scope: 'local' }); }

  async call(method, path, body) {
    const s = await this.session();
    if (!s) throw new ApiError(401, 'Přihlas se prosím.');
    let res;
    try {
      res = await fetch(this.apiUrl + path, {
        method,
        headers: { authorization: `Bearer ${s.access_token}`, apikey: this.anonKey, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'Nejde se spojit se serverem. Zkontroluj připojení.');
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error?.message || 'Něco se pokazilo. Zkus to prosím za chvíli.');
    return data;
  }

  me() { return this.call('GET', '/me'); }
  createProfile(displayName) {
    return this.call('POST', '/me', { displayName, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  }
  settings(patch) { return this.call('PATCH', '/me/settings', patch); }
  setAvatar(image) { return this.call('PUT', '/me/avatar', { image }); }
  deleteAvatar() { return this.call('DELETE', '/me/avatar'); }
  consent(type, granted) { return this.call('POST', '/me/consents', { type, granted }); }
  exportData() { return this.call('GET', '/me/export'); }
  deleteAccount() { return this.call('DELETE', '/me'); }

  game() { return this.call('GET', '/game'); }
  moments() { return this.call('GET', '/activities'); }
  logMoment(m) { return this.call('POST', '/activities', { id: newId(), done: true, ...m }); }
  customActivities() { return this.call('GET', '/custom-activities'); }
  weeklyGoal() { return this.call('GET', '/me/weekly-goal'); }
  setWeeklyGoal(category, target) { return this.call('PUT', '/me/weekly-goal', { category, target }); }
  deleteWeeklyGoal() { return this.call('DELETE', '/me/weekly-goal'); }
  createCustomActivity(title) { return this.call('POST', '/custom-activities', { title }); }
  deleteCustomActivity(id) { return this.call('DELETE', `/custom-activities/${id}`); }
  sharePreview(id, visibility, crewId) { return this.call('POST', `/activities/${id}/share-preview`, { visibility, ...(crewId ? { crewId } : {}) }); }
  share(id, visibility, previewToken, crewId) { return this.call('POST', `/activities/${id}/share`, { visibility, previewToken, ...(crewId ? { crewId } : {}) }); }
  unshare(id) { return this.call('POST', `/activities/${id}/unshare`); }

  friends() { return this.call('GET', '/friends'); }
  feed() { return this.call('GET', '/friends/feed'); }
  createInvite() { return this.call('POST', '/friends/invites'); }
  previewInvite(token) { return this.call('POST', '/friends/invites/preview', { token }); }
  acceptInvite(token) { return this.call('POST', '/friends/invites/accept', { token }); }
  confirmFriend(id) { return this.call('POST', `/friends/${id}/confirm`); }
  removeFriend(id) { return this.call('DELETE', `/friends/${id}`); }
  block(id) { return this.call('POST', `/blocks/${id}`); }

  pings() { return this.call('GET', '/pings'); }
  sendPing(recipientId, kind) { return this.call('POST', '/pings', { id: newId(), recipientId, kind }); }
  restInvites() { return this.call('GET', '/rest-invitations'); }
  async sendRestInvite(recipientId, category) {
    const id = newId();
    await this.call('POST', '/rest-invitations', { id, recipientId, category });
    return { odeslano: true, id };
  }
  answerRestInvite(id, odpoved) { return this.call('POST', `/rest-invitations/${id}/answer`, { odpoved }); }

  groups() { return this.call('GET', '/groups'); }
  createGroup(name) { return this.call('POST', '/groups', { name }); }
  createGoal(groupId, category, target) { return this.call('POST', `/groups/${groupId}/goals`, { category, target }); }
  inviteToGroup(groupId, friendId) { return this.call('POST', `/groups/${groupId}/invitations`, { friendId }); }
  deleteGroup(groupId) { return this.call('DELETE', `/groups/${groupId}`); }
  leaveGroup(groupId) { return this.call('DELETE', `/groups/${groupId}/membership`); }
  groupInvitations() { return this.call('GET', '/group-invitations'); }
  answerGroupInvite(id, accept) { return this.call('POST', `/group-invitations/${id}/answer`, { accept }); }

  checkin(mood) { return this.call('POST', '/checkins', { id: newId(), mood }); }
}

// =====================================================================
// Ukázkový režim (bez serveru). Pravidla hry odpovídají backendu (zjednodušeně).
// =====================================================================
const DEMO_KEY = 'odpocivat-spolu-demo-v1';
const dayStr = (offset = 0) => { const d = new Date(); d.setHours(d.getHours() - 4); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const levelPoints = (n) => (n <= 1 ? 0 : Math.round(50 * Math.pow(n - 1, 1.4)));
const levelFor = (p) => { let l = 1; while (levelPoints(l + 1) <= p) l++; return l; };
const weekStart = (d) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };

function demoSeed() {
  const friends = [
    { id: 'f-tom', jmeno: 'Tom', stav: 'PRATELE' },
    { id: 'f-ema', jmeno: 'Ema', stav: 'PRATELE' },
    { id: 'f-jakub', jmeno: 'Jakub', stav: 'PRATELE' },
    { id: 'f-bara', jmeno: 'Bára', stav: 'CEKA_NA_TEBE' },
  ];
  return {
    loggedIn: false,
    profile: null,
    settings: { gameEnabled: true, shareBadges: false, receivePings: true, receiveRestInvites: true, quietHoursEnabled: true, quietStart: '22:00', quietEnd: '08:00', timezone: 'Europe/Prague', autoShareFriends: false },
    consents: {},
    moments: [
      { id: newId(), category: 'PROCHAZKA', status: 'SPLNENO', visibility: 'JEN_JA', day: dayStr(-9), joint: false },
      { id: newId(), category: 'PROCHAZKA', status: 'SPLNENO', visibility: 'PRATELE', day: dayStr(-5), joint: false },
      { id: newId(), category: 'CTENI', status: 'SPLNENO', visibility: 'JEN_JA', day: dayStr(-4), joint: false },
      { id: newId(), category: 'PAUZA', status: 'SPLNENO', visibility: 'JEN_JA', day: dayStr(-2), joint: false },
    ],
    friends,
    blocked: [],
    pingsSent: [],
    pingsReceived: [{ id: newId(), odKoho: 'Tom', odKohoId: 'f-tom', text: 'Dej si dnes pauzu.', kdy: new Date().toISOString() }],
    restInvites: [{ id: 'ri-tom', smer: 'PRICHOZI', kdo: 'Tom', kdoId: 'f-tom', kategorie: 'PROCHAZKA', status: 'CEKA' }],
    feed: [
      { id: 'x1', authorName: 'Ema', label: 'Čtení pro radost', day: dayStr(0), visibility: 'PRATELE', authorId: 'f-ema' },
      { id: 'x2', authorName: 'Tom', label: 'Procházka venku', day: dayStr(0), visibility: 'CHILL_CREW', authorId: 'f-tom' },
      { id: 'x3', authorName: 'Jakub', label: 'Večer bez telefonu', day: dayStr(-1), visibility: 'PRATELE', authorId: 'f-jakub' },
    ],
    groups: [{ id: 'g-chill', nazev: 'Chill crew', goals: [{ goalId: 'goal-1', category: 'PROCHAZKA', target: 10, othersTogether: 7, contributions: [] }] }],
    badges: {},
  };
}

class DemoApi {
  constructor() {
    this.demo = true;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { /* soukromé okno apod. */ }
    this.s = saved || demoSeed();
    // starší uložená ukázka měla jen jednu skupinu s jedním cílem
    if (!this.s.groups) {
      const g = this.s.group;
      if (g && !g.goals) g.goals = g.goalId ? [{ goalId: g.goalId, category: g.goalCategory, target: g.target, othersTogether: g.othersTogether || 0, contributions: g.contributions || [] }] : [];
      this.s.groups = g ? [g] : [];
      delete this.s.group;
    }
    this.listeners = [];
  }
  save() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.s)); } catch { /* nevadí */ } }
  async wait() { await new Promise((r) => setTimeout(r, 150)); }

  async session() { return this.s.loggedIn ? { user: { email: 'klara@ukazka.cz' } } : null; }
  onAuthChange(cb) { this.listeners.push(cb); }
  emit() { this.listeners.forEach((cb) => cb(this.s.loggedIn ? {} : null)); }
  async signUp(email, password) {
    if (password.length < 10) throw new ApiError(400, 'Heslo musí mít aspoň 10 znaků.');
    this.s.loggedIn = true; this.save(); this.emit();
    return { needsConfirmation: false };
  }
  async signIn() { this.s.loggedIn = true; this.save(); this.emit(); }
  async resetPassword() {}
  async resendConfirmation() {}
  async signOut() { this.s.loggedIn = false; this.save(); this.emit(); }
  reset() { try { localStorage.removeItem(DEMO_KEY); } catch { /* nevadí */ } this.s = demoSeed(); }

  async me() {
    await this.wait();
    if (!this.s.profile) return { profil: null };
    return {
      profil: { id: 'me', prezdivka: this.s.profile, fotka: this.s.avatar || null },
      nastaveni: this.s.settings,
      souhlasy: Object.entries(this.s.consents).map(([typ, platny]) => ({ typ, platny })),
    };
  }
  async createProfile(name) { this.s.profile = name.trim().slice(0, 40); this.save(); return this.me(); }
  async settings(patch) { Object.assign(this.s.settings, patch); this.save(); return this.me(); }
  async setAvatar(image) { this.s.avatar = image; this.save(); return this.me(); }
  async deleteAvatar() { this.s.avatar = null; this.save(); return this.me(); }
  async consent(type, granted) { this.s.consents[type] = granted; this.save(); return this.me(); }
  async exportData() { return JSON.parse(JSON.stringify(this.s)); }
  async deleteAccount() { this.reset(); this.save(); this.emit(); return { smazano: true }; }

  computeGame() {
    const done = this.s.moments.filter((m) => m.status === 'SPLNENO').sort((a, b) => a.day.localeCompare(b.day));
    let points = 0; const perDay = {}; const jointDay = {}; const perWeek = {};
    for (const m of done) {
      perDay[m.day] = (perDay[m.day] || 0) + 1;
      if (perDay[m.day] <= 2) { points += 10; const w = weekStart(m.day); perWeek[w] = (perWeek[w] || 0) + 1; }
      if (m.joint && !jointDay[m.day]) { points += 5; jointDay[m.day] = true; }
    }
    const pingWeeks = {};
    for (const p of this.s.pingsSent) { const w = weekStart(p.day); pingWeeks[w] = (pingWeeks[w] || 0) + 1; if (pingWeeks[w] <= 5) points += 2; }
    const rhythm = Object.values(perWeek).filter((n) => n >= 3).length;
    points += rhythm * 15;
    const days = [...new Set(done.map((m) => m.day))];
    let comeback = false;
    for (let i = 1; i < days.length; i++) if ((new Date(days[i]) - new Date(days[i - 1])) / 864e5 >= 14) { points += 20; comeback = i === days.length - 1 || comeback; }
    const today = dayStr(0);
    const zahrada = {};
    for (const m of done) zahrada[m.category] = (zahrada[m.category] || 0) + 1;
    const level = levelFor(points);
    const cap = (perDay[today] || 0) >= 2;
    return {
      hraZapnuta: true, uroven: level, body: points, dalsiUrovenPri: levelPoints(level + 1), aktualniUrovenOd: levelPoints(level),
      chvilekTentoTyden: done.filter((m) => weekStart(m.day) === weekStart(today)).length,
      tydnuSRytmem: rhythm,
      zprava: cap ? 'Na dnešek máš hotovo. Užij si zbytek dne.' : null,
      zahrada,
      odznaky: this.badgeList(done),
    };
  }
  badgeList(done) {
    const names = { PRVNI_CHVILKA: 'První chvilka', NAVRAT: 'Návrat', DOBRY_KAMARAD: 'Dobrý kamarád', BEZ_TELEFONU: 'Bez obrazovky', SPOLU: 'Spolu', PESTROST: 'Pestrost' };
    const earned = new Set();
    if (done.length) earned.add('PRVNI_CHVILKA');
    if (this.s.pingsSent.length) earned.add('DOBRY_KAMARAD');
    if (done.some((m) => m.category === 'BEZ_TELEFONU')) earned.add('BEZ_TELEFONU');
    if (done.some((m) => m.joint)) earned.add('SPOLU');
    if (new Set(done.map((m) => m.category)).size >= 5) earned.add('PESTROST');
    return [...earned].map((code) => ({ code, name: names[code] }));
  }
  async game() { await this.wait(); return this.s.settings.gameEnabled ? this.computeGame() : { hraZapnuta: false }; }
  async moments() {
    await this.wait();
    return [...this.s.moments].reverse().map((m) => ({ id: m.id, category: m.category, customActivityId: m.customActivityId || null,
      label: m.customTitle || CAT[m.category].title, status: m.status, visibility: m.visibility, crewId: m.crewId || null, day: m.day }));
  }
  async weeklyGoal() {
    await this.wait();
    const g = this.s.personalGoal;
    const week = weekStart(dayStr(0));
    if (!g || g.weekStart !== week) return { cil: null };
    const done = this.s.moments.filter((m) => m.status === 'SPLNENO' && weekStart(m.day) === week && (!g.category || m.category === g.category)).length;
    const noun = g.category ? CAT[g.category].gen : (g.target === 1 ? 'chvilky' : 'chvilek');
    const reached = done >= g.target;
    return { cil: { category: g.category, hotovo: done, cil: g.target, splneno: reached,
      text: reached ? `Máš to! ${done} z ${g.target} ${noun} tento týden.` : `Tento týden ${done} z ${g.target} ${noun}` } };
  }
  async setWeeklyGoal(category, target) { this.s.personalGoal = { weekStart: weekStart(dayStr(0)), category, target }; this.save(); return this.weeklyGoal(); }
  async deleteWeeklyGoal() { this.s.personalGoal = null; this.save(); }
  async customActivities() { await this.wait(); return (this.s.custom || []).map((c) => ({ id: c.id, nazev: c.nazev })); }
  async createCustomActivity(title) {
    this.s.custom = this.s.custom || [];
    if (this.s.custom.length >= 12) throw new ApiError(429, 'Vlastních chvilek už máš hodně. Některou odeber a pak přidej novou.');
    const c = { id: newId(), nazev: String(title).trim().replace(/\s+/g, ' ').slice(0, 60) };
    this.s.custom.push(c); this.save(); return c;
  }
  async deleteCustomActivity(id) { this.s.custom = (this.s.custom || []).filter((c) => c.id !== id); this.save(); }
  async logMoment({ category, restInvitationId, goalIds = [], customActivityId }) {
    const custom = customActivityId ? (this.s.custom || []).find((c) => c.id === customActivityId) : null;
    if (customActivityId && !custom) throw new ApiError(404, 'Tuhle vlastní chvilku jsme nenašli.');
    if (custom) category = 'JINE';
    await this.wait();
    const before = levelFor(this.computeGame().body);
    const joint = !!restInvitationId && this.s.restInvites.some((r) => r.id === restInvitationId && r.status === 'PRIDAM_SE');
    // Nový záznam je vždy soukromý, stejně jako na serveru.
    // Jako na serveru: vzniká „Jen já“, a kdo si zapnul automatické sdílení, tomu se hned nasdílí přátelům.
    const auto = !!this.s.settings.autoShareFriends;
    const m = { id: newId(), category, status: 'SPLNENO', visibility: auto ? 'PRATELE' : 'JEN_JA', day: dayStr(0), joint, customActivityId: custom?.id, customTitle: custom?.nazev };
    this.s.moments.push(m);
    const counted = [];
    for (const goal of this.s.groups.flatMap((g) => g.goals)) {
      if (goalIds.includes(goal.goalId) && category === goal.category) { goal.contributions.push(m.id); counted.push(goal.goalId); }
    }
    this.save();
    const hra = this.s.settings.gameEnabled ? this.computeGame() : { hraZapnuta: false };
    const levelUp = hra.hraZapnuta && hra.uroven > before;
    return { chvile: m, zapocitanoDoCilu: counted, hra, zprava: levelUp ? `Nová úroveň ${hra.uroven}!` : hra.zprava || 'Chvilka pro tebe je zapsaná.' };
  }
  findMoment(id) { const m = this.s.moments.find((x) => x.id === id); if (!m) throw new ApiError(404, 'Tohle jsme nenašli.'); return m; }
  async sharePreview(id, visibility, crewId) {
    const m = this.findMoment(id);
    return {
      // Název vlastní chvilky ostatní neuvidí (může být osobní), jen obecné „Chvíle pro sebe“.
      nahled: { authorName: this.s.profile, label: m.category === 'JINE' ? 'Chvilka pro sebe' : CAT[m.category].title, day: m.day, visibility },
      publikum: visibility === 'PRATELE' ? 'Uvidí tvoji přátelé.' : `Uvidí členové skupiny ${(this.s.groups.find((g) => g.id === crewId) || this.s.groups[0])?.nazev || ''}.`,
      poznamka: null,
      previewToken: `demo.${id}.${visibility}`,
    };
  }
  async share(id, visibility, token, crewId) {
    if (token !== `demo.${id}.${visibility}`) throw new ApiError(400, 'Podívej se prosím znovu na náhled, než to nasdílíš.');
    const m = this.findMoment(id); m.visibility = visibility; m.crewId = visibility === 'CHILL_CREW' ? crewId : null; this.save();
  }
  async unshare(id) { const m = this.findMoment(id); m.visibility = 'JEN_JA'; m.crewId = null; this.save(); }

  async friends() { await this.wait(); return this.s.friends.filter((f) => !this.s.blocked.includes(f.id)); }
  async feed() { await this.wait(); return this.s.feed.filter((f) => !this.s.blocked.includes(f.authorId)); }
  async createInvite() { return { id: newId(), odkaz: `${location.origin}${location.pathname}#/pozvanka/ukazkovy-odkaz-${Math.random().toString(36).slice(2, 10)}`, platiDo: new Date(Date.now() + 72 * 36e5).toISOString() }; }
  async previewInvite() { return { odKoho: 'Ukázkový kamarád' }; }
  async acceptInvite() { return { stav: 'PRATELE' }; }
  async confirmFriend(id) { const f = this.s.friends.find((x) => x.id === id); if (f) f.stav = 'PRATELE'; this.save(); }
  async removeFriend(id) { this.s.friends = this.s.friends.filter((f) => f.id !== id); this.save(); }
  async block(id) { this.s.blocked.push(id); this.save(); }

  async pings() { await this.wait(); return this.s.pingsReceived.filter((p) => !this.s.blocked.includes(p.odKohoId)); }
  async sendPing(recipientId) { this.s.pingsSent.push({ to: recipientId, day: dayStr(0) }); this.save(); return { odeslano: true }; }
  async restInvites() {
    await this.wait();
    const labels = { PRIDAM_SE: 'Přidá se', TED_NE: 'Tentokrát to nevyjde', CEKA: 'Čeká na odpověď' };
    return this.s.restInvites.filter((r) => !this.s.blocked.includes(r.kdoId)).map((r) => ({
      id: r.id, smer: r.smer, kdo: r.kdo, kdoId: r.kdoId, kategorie: r.kategorie, prijato: r.status === 'PRIDAM_SE',
      text: CAT[r.kategorie].title, muzesOdpovedet: r.smer === 'PRICHOZI' && r.status === 'CEKA',
      stav: r.smer === 'PRICHOZI' ? r.status : labels[r.status],
    }));
  }
  async sendRestInvite(recipientId, category) {
    const f = this.s.friends.find((x) => x.id === recipientId);
    const r = { id: newId(), smer: 'ODESLANA', kdo: f?.jmeno || '', kdoId: recipientId, kategorie: category, status: 'CEKA' };
    this.s.restInvites.unshift(r); this.save();
    // Ukázka: kamarád se za pár vteřin přidá.
    setTimeout(() => { r.status = 'PRIDAM_SE'; this.save(); window.dispatchEvent(new CustomEvent('demo-update', { detail: `${r.kdo} se přidá: ${CAT[category].title}.` })); }, 3000);
    return { odeslano: true, id: r.id };
  }
  async answerRestInvite(id, odpoved) { const r = this.s.restInvites.find((x) => x.id === id); if (r) r.status = odpoved; this.save(); return { stav: odpoved }; }

  async groups() {
    await this.wait();
    return this.s.groups.map((g, i) => ({
      id: g.id, nazev: g.nazev, mojeSkupina: true,
      // ukázka: v první skupině jsou vymyšlení kamarádi, v nových jen ty
      clenove: i === 0 && g.id === 'g-chill' ? [{ id: 'me', jmeno: this.s.profile }, { id: 'f-tom', jmeno: 'Tom' }, { id: 'f-ema', jmeno: 'Ema' }] : [{ id: 'me', jmeno: this.s.profile }],
      cile: g.goals.map((x) => {
        const together = x.othersTogether + x.contributions.length;
        const cat = CAT[x.category];
        return { goalId: x.goalId, category: x.category, together, target: x.target, reached: together >= x.target,
          text: together >= x.target ? `Spolu jste to dali! ${together} z ${x.target} ${cat.gen}.` : `Spolu ${together} z ${x.target} ${cat.gen}` };
      }),
    }));
  }
  async createGroup(name) {
    if (this.s.groups.length >= 10) throw new ApiError(400, 'Skupin už máš hodně. Zkus nejdřív některou z nich.');
    const g = { id: newId(), nazev: String(name || 'Chill crew').trim().slice(0, 40), goals: [] };
    this.s.groups.push(g); this.save();
    return { id: g.id, nazev: g.nazev };
  }
  async createGoal(groupId, category, target) {
    const g = this.s.groups.find((x) => x.id === groupId);
    if (!g) throw new ApiError(404, 'Tuhle skupinu jsme nenašli.');
    if (g.goals.some((x) => x.category === category)) throw new ApiError(409, 'Tuhle výzvu už tento týden máte. Vyber jiný druh odpočinku.');
    // Ukázka: kamarádi už mají pár chvilek za sebou, ať je vidět společný součet.
    g.goals.push({ goalId: newId(), category, target, othersTogether: g.id === 'g-chill' ? Math.min(2, target - 1) : 0, contributions: [] }); this.save();
    return {};
  }
  async inviteToGroup() { return { id: newId() }; }
  async deleteGroup(groupId) { this.s.groups = this.s.groups.filter((g) => g.id !== groupId); this.save(); }
  async leaveGroup(groupId) { return this.deleteGroup(groupId); }
  async groupInvitations() { return this.s.groupInviteAnswered ? [] : [{ id: 'gi-1', skupina: 'Knihomolové', odKoho: 'Ema' }]; }
  async answerGroupInvite() { this.s.groupInviteAnswered = true; this.save(); return {}; }

  async checkin(mood) {
    if (!this.s.consents.ZDRAVOTNI_UDAJE) throw new ApiError(403, 'Abychom mohli náladu ukládat, potřebujeme tvůj souhlas.');
    return { ulozeno: true, nabidnoutPomoc: mood === 1 };
  }
}

function createApi() {
  const cfg = window.APP_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) return new SupabaseApi(cfg);
  return new DemoApi();
}

window.OS = { createApi, CATEGORIES, CAT, PRESETS, ApiError, levelPoints };
})();
