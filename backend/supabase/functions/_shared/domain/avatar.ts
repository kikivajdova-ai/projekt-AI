// Ověření profilové fotky (čistá funkce, testovaná v tests/domain.test.ts).
import { AppError } from '../errors.ts';

const MAX_BYTES = 150_000;
const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  webp: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

export function validateAvatar(dataUrl: string): string {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new AppError(400, 'FOTKA_FORMAT', 'Fotka musí být obrázek JPG, PNG nebo WebP.');
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  } catch {
    throw new AppError(400, 'FOTKA_FORMAT', 'Fotku se nepodařilo přečíst. Zkus jinou.');
  }
  if (bytes.length > MAX_BYTES) throw new AppError(400, 'FOTKA_VELKA', 'Fotka je moc velká. Zkus menší.');
  if (!SIGNATURES[m[1]](bytes)) throw new AppError(400, 'FOTKA_FORMAT', 'Fotku se nepodařilo přečíst. Zkus jinou.');
  return dataUrl;
}

