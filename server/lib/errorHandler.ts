import { isHttpError } from './httpError';

export function handleError(c: any, error: unknown, fallbackMessage: string) {
  if (isHttpError(error)) {
    return c.json({ error: error.message }, error.status as 400 | 401 | 404 | 409 | 429 | 500);
  }
  console.error(error);
  return c.json({ error: fallbackMessage }, 500);
}
