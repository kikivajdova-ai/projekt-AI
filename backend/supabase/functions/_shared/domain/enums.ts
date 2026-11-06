// Výčty hodnot sdílené databázovým schématem (Drizzle pgEnum), validací API (zod)
// i doménovou logikou. Jedno místo pravdy: když tady něco přidáš, propíše se všude.

/** Kdo záznam vidí. Nový záznam je VŽDY JEN_JA (vynucuje to i databáze). */
export const VISIBILITY = ['JEN_JA', 'PRATELE', 'CHILL_CREW'] as const;
export type Visibility = (typeof VISIBILITY)[number];

/**
 * Stav odpočinkové chvíle. Záměrně tu NENÍ žádný stav typu „nesplněno“ nebo „propadlo“:
 * co člověk neudělal, se vůbec neukládá, takže to nikdy nemůže nikdo vidět.
 */
export const ACTIVITY_STATUS = ['NAPLANOVANO', 'SPLNENO'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUS)[number];

export const ACTIVITY_CATEGORY = [
  'PROCHAZKA',
  'CTENI',
  'PAUZA',
  'SPANEK',
  'BEZ_TELEFONU',
  'POHYB',
  'TVORENI',
  'JINE',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORY)[number];

export const FRIENDSHIP_STATUS = ['CEKA', 'PRIJATO'] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUS)[number];

/** Povzbuzení jedním klepnutím: jen připravené zprávy, žádný volný text, žádná odpověď. */
export const PING_KIND = ['MYSLIM_NA_TEBE', 'DEJ_SI_PAUZU', 'FANDIM_TI'] as const;
export type PingKind = (typeof PING_KIND)[number];

/** Odpověď na pozvánku k odpočinku. Odmítnutí je jen stav TED_NE, žádné vysvětlování. */
export const REST_INVITE_STATUS = ['CEKA', 'PRIDAM_SE', 'TED_NE'] as const;
export type RestInviteStatus = (typeof REST_INVITE_STATUS)[number];
export const REST_INVITE_ANSWER = ['PRIDAM_SE', 'TED_NE'] as const;
export type RestInviteAnswer = (typeof REST_INVITE_ANSWER)[number];

export const GROUP_ROLE = ['ZAKLADATEL', 'CLEN'] as const;
export const GROUP_INVITE_STATUS = ['CEKA', 'PRIJATO', 'ODMITNUTO'] as const;

export const REPORT_REASON = [
  'OBTEZOVANI',
  'NEVHODNY_OBSAH',
  'SPAM',
  'BEZPECNOST_DITETE',
  'JINE',
] as const;
export type ReportReason = (typeof REPORT_REASON)[number];
export const REPORT_STATUS = ['NOVE', 'PREDANO', 'VYRESENO'] as const;

export const CONSENT_TYPE = ['ZDRAVOTNI_UDAJE', 'PODMINKY'] as const;
export type ConsentType = (typeof CONSENT_TYPE)[number];

export const NOTIFICATION_KIND = [
  'POVZBUZENI',
  'POZVANKA_K_ODPOCINKU',
  'ODPOVED_NA_POZVANKU',
  'ZADOST_O_PRATELSTVI',
  'POZVANKA_DO_SKUPINY',
  'ODZNAK',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KIND)[number];
export const OUTBOX_STATUS = ['CEKA', 'ODESLANO', 'ZAHOZENO'] as const;

export const PUSH_PLATFORM = ['ANDROID', 'IOS'] as const;

/** Kódy odznaků za péči. Žádný z nich se neuděluje za čas v aplikaci ani za počty. */
export const BADGE_CODE = [
  'PRVNI_CHVILKA',
  'NAVRAT',
  'DOBRY_KAMARAD',
  'BEZ_TELEFONU',
  'SPOLU',
  'PESTROST',
] as const;
export type BadgeCode = (typeof BADGE_CODE)[number];
