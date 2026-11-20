import { ignore, tryCatch, unwrapOr } from '@kit/result';
import { ViewerSessionKeySchema } from '@vp/api-contracts';

const STORAGE_KEY = 'vp.viewer-session';

/**
 * This tab's ephemeral key, which the API picks the viewer's test variants by: random, kept in
 * `sessionStorage` so a reload sees the same variant, and gone with the tab. Never a cookie, and
 * nothing about the viewer. Blocked storage gives a fresh key per page load.
 */
export function viewerSessionKey(): string {
  const kept = ViewerSessionKeySchema.safeParse(
    unwrapOr(
      tryCatch(
        () => window.sessionStorage.getItem(STORAGE_KEY),
        (cause) => cause
      ),
      null
    )
  );
  if (kept.success) return kept.data;

  const key = crypto.randomUUID();
  ignore(
    tryCatch(
      () => window.sessionStorage.setItem(STORAGE_KEY, key),
      (cause) => cause
    ),
    'blocked storage keeps the key for this page load alone'
  );
  return key;
}
