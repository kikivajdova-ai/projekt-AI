// Obsah push notifikací. Pravidlo: text musí být bezpečný i na ZAMČENÉ obrazovce, takže
// neobsahuje jména, náladu, typ odpočinku ani obsah zprávy. Podrobnosti uvidí člověk
// až po odemčení v aplikaci (podle `data.type` a `data.refId`).

import type { NotificationKind } from './enums.ts';

export const APP_TITLE = 'Odpočívat spolu';

const BODY: Record<NotificationKind, string> = {
  POVZBUZENI: 'Máš nové povzbuzení.',
  POZVANKA_K_ODPOCINKU: 'Máš pozvánku k odpočinku.',
  ODPOVED_NA_POZVANKU: 'Máš odpověď na pozvánku.',
  ZADOST_O_PRATELSTVI: 'Máš novou žádost o přátelství.',
  POZVANKA_DO_SKUPINY: 'Máš pozvánku do skupiny.',
  ODZNAK: 'Máš nový odznak.',
};

export interface SafePushMessage {
  title: string;
  body: string;
  /** Jen technické údaje pro otevření správné obrazovky. Žádný citlivý obsah. */
  data: { type: NotificationKind; refId: string };
}

/**
 * Jediný způsob, jak vytvořit push zprávu. Záměrně nepřijímá žádný volný text,
 * jméno odesílatele ani obsah, takže citlivý údaj se do notifikace nedostane ani omylem.
 */
export function buildPushMessage(kind: NotificationKind, refId: string): SafePushMessage {
  if (!/^[0-9a-f-]{36}$/i.test(refId)) throw new Error('refId musí být UUID');
  return { title: APP_TITLE, body: BODY[kind], data: { type: kind, refId } };
}

/** Které nastavení uživatele rozhoduje, jestli daný druh notifikace vůbec chce. */
export interface NotificationPrefs {
  receivePings: boolean;
  receiveRestInvites: boolean;
  gameEnabled: boolean;
}

export function wantsNotification(kind: NotificationKind, prefs: NotificationPrefs): boolean {
  switch (kind) {
    case 'POVZBUZENI':
      return prefs.receivePings;
    case 'POZVANKA_K_ODPOCINKU':
    case 'ODPOVED_NA_POZVANKU':
      return prefs.receiveRestInvites;
    case 'ODZNAK':
      // když má člověk hru vypnutou, nic mu ji nepřipomíná
      return prefs.gameEnabled;
    default:
      return true;
  }
}
