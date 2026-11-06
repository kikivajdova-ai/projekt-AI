// Chyby, které smí vidět uživatel: srozumitelná česká věta, žádné názvy tabulek ani stack trace.

export class AppError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Tohle jsme nenašli.') => new AppError(404, 'NENALEZENO', message);
export const forbidden = (message = 'Na tohle nemáš oprávnění.') => new AppError(403, 'ZAKAZANO', message);
export const tooMany = (message = 'Pro dnešek toho bylo dost, zkus to zítra.') =>
  new AppError(429, 'MOC_POZADAVKU', message);
