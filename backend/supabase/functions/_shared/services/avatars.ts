// Profilová fotka. Klient ji předem zmenší na čtverec 256 px; server jen ověří, že jde
// opravdu o malý obrázek JPEG/PNG/WebP (podle hlavičky dat, ne podle toho, co tvrdí klient).

import { eq } from 'drizzle-orm';
import { asUser } from '../db/client.ts';
import { avatars } from '../db/schema/index.ts';
import { validateAvatar } from '../domain/avatar.ts';

export async function setAvatar(userId: string, dataUrl: string) {
  const image = validateAvatar(dataUrl);
  await asUser(userId, (tx) =>
    tx
      .insert(avatars)
      .values({ userId, image })
      .onConflictDoUpdate({ target: avatars.userId, set: { image, updatedAt: new Date() } }),
  );
}

export async function deleteAvatar(userId: string) {
  await asUser(userId, (tx) => tx.delete(avatars).where(eq(avatars.userId, userId)));
}
