/**
 * Work around intermittent upstream PGRST303 time skew for read-only REST calls.
 * Supabase can mint a short-lived internal JWT for opaque sb_secret_/sb_publishable_
 * keys; some PostgREST instances reject its fresh iat as "issued at future".
 *
 * Never retry POST/PATCH/DELETE: their first attempt may already have committed.
 * Return the original Response unchanged unless a narrowly matched transient
 * authentication failure justifies one of the bounded retries.
 */
export async function catalogueRestFetch(
  url: string,
  init: RequestInit = {},
  request: (url: string, init: RequestInit) => Promise<Response> = fetch,
  delaysMs: readonly number[] = [1500, 3500, 6500],
  pause: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const retryable = method === "GET" || method === "HEAD";
  for (let attempt = 0; ; attempt += 1) {
    const response = await request(url, init);
    if (!retryable || response.status !== 401 || attempt >= delaysMs.length) {
      return response;
    }

    let transientSkew = false;
    try {
      const error = await response.clone().json() as {
        code?: unknown;
        message?: unknown;
      };
      transientSkew =
        error.code === "PGRST303" &&
        typeof error.message === "string" &&
        /JWT issued at future/i.test(error.message);
    } catch {
      return response;
    }
    if (!transientSkew) return response;
    await pause(delaysMs[attempt] ?? 0);
  }
}
