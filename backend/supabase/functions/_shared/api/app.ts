// HTTP API (Hono). Každá cesta: ověří přihlášení -> zvaliduje vstup (zod, strict =
// neznámá pole se odmítnou) -> zavolá službu. Neexistuje cesta pro vyhledávání
// uživatelů ani pro žebříčky (hlídá test tests/guards.test.ts).

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import {
  ACTIVITY_CATEGORY,
  CONSENT_TYPE,
  PING_KIND,
  PUSH_PLATFORM,
  REPORT_REASON,
  REST_INVITE_ANSWER,
  VISIBILITY,
} from '../domain/enums.ts';
import { MOOD_MAX, MOOD_MIN } from '../domain/config.ts';
import { AppError } from '../errors.ts';
import { appOrigins } from '../env.ts';
import { requireUser, type AuthEnv } from './auth.ts';
import * as account from '../services/account.ts';
import * as moments from '../services/activities.ts';
import * as checkins from '../services/checkins.ts';
import * as custom from '../services/customActivities.ts';
import * as avatar from '../services/avatars.ts';
import * as personalGoal from '../services/personalGoal.ts';
import * as friends from '../services/friends.ts';
import * as game from '../services/game.ts';
import * as groups from '../services/groups.ts';
import * as interactions from '../services/interactions.ts';
import * as notifications from '../services/notifications.ts';

const id = z.uuid();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const displayName = z.string().trim().min(1).max(40);

const schemas = {
  profile: z.strictObject({ displayName, timezone: z.string().max(64).optional() }),
  displayName: z.strictObject({ displayName }),
  settings: z
    .strictObject({
      timezone: z.string().max(64),
      gameEnabled: z.boolean(),
      shareBadges: z.boolean(),
      receivePings: z.boolean(),
      receiveRestInvites: z.boolean(),
      quietHoursEnabled: z.boolean(),
      quietStart: hhmm,
      quietEnd: hhmm,
      autoShareFriends: z.boolean(),
    })
    .partial(),
  consent: z.strictObject({ type: z.enum(CONSENT_TYPE), granted: z.boolean() }),
  token: z.strictObject({ token: z.string().min(1).max(100) }),
  report: z.strictObject({
    reportedUserId: id.optional(),
    reason: z.enum(REPORT_REASON),
    details: z.string().trim().max(1000).optional(),
    contextType: z.enum(['ping', 'rest_invitation', 'activity', 'group', 'profile']).optional(),
    contextId: id.optional(),
    alsoBlock: z.boolean().optional(),
  }),
  // Pozor: pole `visibility` tu záměrně NENÍ. Nový záznam je vždy soukromý.
  moment: z.strictObject({
    id,
    category: z.enum(ACTIVITY_CATEGORY),
    done: z.boolean().default(true),
    occurredAt: z.coerce.date().optional(),
    restInvitationId: id.optional(),
    goalIds: z.array(id).max(10).optional(),
    customActivityId: id.optional(),
  }),
  customActivity: z.strictObject({ title: z.string().trim().min(1).max(60) }),
  avatar: z.strictObject({ image: z.string().max(220000) }),
  personalGoal: z.strictObject({ category: z.enum(ACTIVITY_CATEGORY).nullable(), target: z.number().int().min(1).max(50) }),
  complete: z.strictObject({ goalIds: z.array(id).max(10).optional() }),
  shareTarget: z.strictObject({ visibility: z.enum(VISIBILITY), crewId: id.optional() }),
  share: z.strictObject({
    visibility: z.enum(VISIBILITY),
    crewId: id.optional(),
    previewToken: z.string().min(10).max(200),
  }),
  checkin: z.strictObject({
    id,
    mood: z.number().int().min(MOOD_MIN).max(MOOD_MAX),
    stress: z.number().int().min(1).max(5).optional(),
  }),
  group: z.strictObject({ name: z.string().trim().min(1).max(40) }),
  groupInvite: z.strictObject({ friendId: id }),
  groupAnswer: z.strictObject({ accept: z.boolean() }),
  goal: z.strictObject({ category: z.enum(ACTIVITY_CATEGORY), target: z.number().int().min(1).max(100) }),
  ping: z.strictObject({ id, recipientId: id, kind: z.enum(PING_KIND) }),
  restInvite: z.strictObject({ id, recipientId: id, category: z.enum(ACTIVITY_CATEGORY) }),
  // Odmítnutí = jen stav. Žádné pole pro důvod; poslat ho nejde (strictObject).
  restAnswer: z.strictObject({ odpoved: z.enum(REST_INVITE_ANSWER) }),
  pushToken: z.strictObject({ token: z.string().min(10).max(4096), platform: z.enum(PUSH_PLATFORM) }),
};

async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 250_000) throw new AppError(413, 'MOC_VELKE', 'Požadavek je moc velký.');
    raw = text.trim() === '' ? {} : JSON.parse(text);
  } catch {
    throw new AppError(400, 'SPATNY_VSTUP', 'Požadavek nejde přečíst.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AppError(400, 'SPATNY_VSTUP', 'Některý údaj nesedí.');
  return parsed.data;
}

const param = (value: string) => {
  const parsed = id.safeParse(value);
  if (!parsed.success) throw new AppError(400, 'SPATNY_VSTUP', 'Neplatné id.');
  return parsed.data;
};

const crew = (t: { visibility: string; crewId?: string }) => (t.visibility === 'CHILL_CREW' ? (t.crewId ?? null) : null);

export function createApp() {
  const app = new Hono<AuthEnv>().basePath('/api');

  // Mobilní aplikace CORS nepotřebuje; webu povolíme jen vlastní doménu (pokud je nastavená).
  const allowedOrigin = appOrigins();
  // Webová aplikace: ALLOWED_ORIGIN = adresa, odkud běží (např. http://localhost:3000).
  // Víc adres jde oddělit čárkou. CORS musí být PŘED kontrolou přihlášení (preflight nemá token).
  if (allowedOrigin) {
    app.use(
      '*',
      cors({
        origin: allowedOrigin.split(',').map((o) => o.trim()),
        allowHeaders: ['authorization', 'content-type', 'apikey', 'x-client-info'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      }),
    );
  }

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
    // Do logu jen typ chyby, žádná data uživatele; ven obecná věta bez detailů.
    // Do logu typ, kód a zprávu chyby (ne detail, ten může obsahovat hodnoty z řádků).
    const e = err as { name?: string; code?: string; message?: string; cause?: { name?: string; code?: string; message?: string } };
    // Drizzle přidává do zprávy „params: …“ s hodnotami dotazu – ty do logu nesmí.
    const short = (s?: string) => (s ?? '').split('\nparams')[0].slice(0, 200);
    console.error('Neočekávaná chyba', JSON.stringify({
      name: e?.name, code: e?.code, message: short(e?.message),
      cause: e?.cause ? { name: e.cause.name, code: e.cause.code, message: short(e.cause.message) } : undefined,
    }));
    return c.json({ error: { code: 'CHYBA', message: 'Něco se pokazilo. Zkus to prosím za chvíli.' } }, 500);
  });

  app.use('*', requireUser);
  const uid = (c: { get(k: 'userId'): string }) => c.get('userId');

  // --- profil, nastavení, souhlasy, GDPR ---
  app.post('/me', async (c) => c.json(await account.createProfile(uid(c), await body(c.req.raw, schemas.profile))));
  app.get('/me', async (c) => c.json(await account.getMe(uid(c))));
  app.put('/me/avatar', async (c) => {
    await avatar.setAvatar(uid(c), (await body(c.req.raw, schemas.avatar)).image);
    return c.json(await account.getMe(uid(c)));
  });
  app.delete('/me/avatar', async (c) => {
    await avatar.deleteAvatar(uid(c));
    return c.json(await account.getMe(uid(c)));
  });
  app.patch('/me/profile', async (c) => {
    await account.updateDisplayName(uid(c), (await body(c.req.raw, schemas.displayName)).displayName);
    return c.json(await account.getMe(uid(c)));
  });
  app.patch('/me/settings', async (c) =>
    c.json(await account.updateSettings(uid(c), await body(c.req.raw, schemas.settings))),
  );
  app.post('/me/consents', async (c) => {
    const b = await body(c.req.raw, schemas.consent);
    return c.json(await account.setConsent(uid(c), b.type, b.granted));
  });
  app.get('/me/export', async (c) => c.json(await account.exportData(uid(c))));
  app.delete('/me', async (c) => c.json(await account.deleteAccount(uid(c))));

  // --- přátelé: jen přes pozvánku, žádné vyhledávání ---
  app.post('/friends/invites', async (c) => c.json(await friends.createFriendInvite(uid(c)), 201));
  app.delete('/friends/invites/:id', async (c) => {
    await friends.revokeFriendInvite(uid(c), param(c.req.param('id')));
    return c.body(null, 204);
  });
  app.post('/friends/invites/preview', async (c) =>
    c.json(await friends.previewFriendInvite(uid(c), (await body(c.req.raw, schemas.token)).token)),
  );
  app.post('/friends/invites/accept', async (c) =>
    c.json(await friends.acceptFriendInvite(uid(c), (await body(c.req.raw, schemas.token)).token)),
  );
  app.get('/friends', async (c) => c.json(await friends.listFriends(uid(c))));
  app.post('/friends/:userId/confirm', async (c) =>
    c.json(await friends.confirmFriend(uid(c), param(c.req.param('userId')))),
  );
  app.delete('/friends/:userId', async (c) => {
    await friends.removeFriend(uid(c), param(c.req.param('userId')));
    return c.body(null, 204);
  });
  app.get('/friends/feed', async (c) => {
    const raw = c.req.query('before');
    const before = raw ? new Date(raw) : undefined;
    if (before && Number.isNaN(before.getTime())) throw new AppError(400, 'SPATNY_VSTUP', 'Neplatné datum.');
    return c.json(await moments.friendsFeed(uid(c), { before }));
  });

  // --- blokování a nahlášení ---
  app.post('/blocks/:userId', async (c) => {
    await friends.blockUser(uid(c), param(c.req.param('userId')));
    return c.body(null, 204);
  });
  app.delete('/blocks/:userId', async (c) => {
    await friends.unblockUser(uid(c), param(c.req.param('userId')));
    return c.body(null, 204);
  });
  app.post('/reports', async (c) => c.json(await friends.reportUser(uid(c), await body(c.req.raw, schemas.report)), 201));

  // --- odpočinkové chvíle ---
  app.post('/activities', async (c) => c.json(await moments.logMoment(uid(c), await body(c.req.raw, schemas.moment)), 201));
  app.get('/activities', async (c) => c.json(await moments.listOwnMoments(uid(c))));

  // --- osobní cíl tohoto týdne (vidí jen autor) ---
  app.get('/me/weekly-goal', async (c) => c.json(await personalGoal.getPersonalGoal(uid(c))));
  app.put('/me/weekly-goal', async (c) =>
    c.json(await personalGoal.setPersonalGoal(uid(c), await body(c.req.raw, schemas.personalGoal))),
  );
  app.delete('/me/weekly-goal', async (c) => {
    await personalGoal.deletePersonalGoal(uid(c));
    return c.body(null, 204);
  });

  // --- vlastní chvilky (název vidí jen autor) ---
  app.get('/custom-activities', async (c) => c.json(await custom.listCustomActivities(uid(c))));
  app.post('/custom-activities', async (c) =>
    c.json(await custom.createCustomActivity(uid(c), (await body(c.req.raw, schemas.customActivity)).title), 201),
  );
  app.delete('/custom-activities/:id', async (c) => {
    await custom.deleteCustomActivity(uid(c), param(c.req.param('id')));
    return c.body(null, 204);
  });
  app.post('/activities/:id/complete', async (c) =>
    c.json(
      await moments.completeMoment(uid(c), param(c.req.param('id')), (await body(c.req.raw, schemas.complete)).goalIds),
    ),
  );
  app.post('/activities/:id/share-preview', async (c) => {
    const t = await body(c.req.raw, schemas.shareTarget);
    return c.json(await moments.sharePreview(uid(c), param(c.req.param('id')), { visibility: t.visibility, crewId: crew(t) }));
  });
  app.post('/activities/:id/share', async (c) => {
    const t = await body(c.req.raw, schemas.share);
    return c.json(
      await moments.share(uid(c), param(c.req.param('id')), {
        visibility: t.visibility,
        crewId: crew(t),
        previewToken: t.previewToken,
      }),
    );
  });
  app.post('/activities/:id/unshare', async (c) => c.json(await moments.unshare(uid(c), param(c.req.param('id')))));
  app.delete('/activities/:id', async (c) => {
    await moments.deleteMoment(uid(c), param(c.req.param('id')));
    return c.body(null, 204);
  });

  // --- nálada a stres (citlivé) ---
  app.post('/checkins', async (c) => c.json(await checkins.createCheckin(uid(c), await body(c.req.raw, schemas.checkin)), 201));
  app.get('/checkins', async (c) => c.json(await checkins.listCheckins(uid(c))));
  app.delete('/checkins/:id', async (c) => {
    await checkins.deleteCheckin(uid(c), param(c.req.param('id')));
    return c.body(null, 204);
  });

  // --- hra ---
  app.get('/game', async (c) => c.json(await game.getGameState(uid(c))));

  // --- skupiny a společné cíle (jen součty) ---
  app.get('/groups', async (c) => c.json(await groups.listMyGroups(uid(c))));
  app.post('/groups', async (c) => c.json(await groups.createGroup(uid(c), (await body(c.req.raw, schemas.group)).name), 201));
  app.post('/groups/:id/invitations', async (c) =>
    c.json(await groups.inviteToGroup(uid(c), param(c.req.param('id')), (await body(c.req.raw, schemas.groupInvite)).friendId), 201),
  );
  app.get('/group-invitations', async (c) => c.json(await groups.listGroupInvitations(uid(c))));
  app.post('/group-invitations/:id/answer', async (c) =>
    c.json(await groups.answerGroupInvite(uid(c), param(c.req.param('id')), (await body(c.req.raw, schemas.groupAnswer)).accept)),
  );
  app.delete('/groups/:id', async (c) => {
    await groups.deleteGroup(uid(c), param(c.req.param('id')));
    return c.body(null, 204);
  });
  app.delete('/groups/:id/membership', async (c) => {
    await groups.leaveGroup(uid(c), param(c.req.param('id')));
    return c.body(null, 204);
  });
  app.post('/groups/:id/goals', async (c) =>
    c.json(await groups.createGoal(uid(c), param(c.req.param('id')), await body(c.req.raw, schemas.goal)), 201),
  );
  app.get('/goals/:id', async (c) => c.json(await groups.getGoalProgress(uid(c), param(c.req.param('id')))));

  // --- povzbuzení a pozvánky k odpočinku ---
  app.post('/pings', async (c) => c.json(await interactions.sendPing(uid(c), await body(c.req.raw, schemas.ping)), 201));
  app.get('/pings', async (c) => c.json(await interactions.listReceivedPings(uid(c))));
  app.post('/rest-invitations', async (c) =>
    c.json(await interactions.sendRestInvite(uid(c), await body(c.req.raw, schemas.restInvite)), 201),
  );
  app.get('/rest-invitations', async (c) => c.json(await interactions.listRestInvites(uid(c))));
  app.post('/rest-invitations/:id/answer', async (c) =>
    c.json(
      await interactions.answerRestInvite(uid(c), param(c.req.param('id')), (await body(c.req.raw, schemas.restAnswer)).odpoved),
    ),
  );

  // --- zařízení pro notifikace ---
  app.post('/push-tokens', async (c) => {
    const b = await body(c.req.raw, schemas.pushToken);
    await notifications.registerPushToken(uid(c), b.token, b.platform);
    return c.body(null, 204);
  });
  app.delete('/push-tokens', async (c) => {
    await notifications.removePushToken(uid(c), (await body(c.req.raw, schemas.token)).token);
    return c.body(null, 204);
  });

  return app;
}
