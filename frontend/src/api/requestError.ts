import { API_ERROR_KEYS } from "../i18n/apiErrors.ts";
import { t } from "../i18n/index.ts";

/**
 * Turns a failed response into the Error a component will show.
 *
 * The backend sends `{ error, code }` for the situations a person has to fix (see
 * `backend/src/services/apiError.ts`). When the code has a translation, the translated sentence is
 * what surfaces; otherwise the canonical text from the response is used as-is, and a response with
 * no body at all falls back to the status.
 *
 * Adding a code to the backend and forgetting the translation does not break anything: it only
 * shows the English text. `npm run i18n:check` catches that drift before it ships.
 */
/** An Error that remembers the stable code the backend sent, for callers that branch on it. */
export interface ApiError extends Error {
  code?: string;
}

export async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  return errorFromBody(body, response.status);
}

/**
 * Same decision, for callers that already read the body for their own fields. `fallback` is the
 * already-translated sentence that screen wants to show when the response carries nothing useful.
 */
export function errorFromBody(body: unknown, status: number, fallback?: string): Error {
  const payload = body as { error?: unknown; code?: unknown } | null;
  const code = payload?.code;
  if (typeof code === "string") {
    const key = API_ERROR_KEYS[code];
    if (key) return new Error(t(key));
  }
  const error = new Error(
    typeof payload?.error === "string" && payload.error ? payload.error : (fallback ?? `Request failed (${status})`),
  ) as ApiError;
  if (typeof code === "string") error.code = code;
  return error;
}
