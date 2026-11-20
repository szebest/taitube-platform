import { fromPromise, isOk } from '@kit/result';
import { createServerFn } from '@tanstack/react-start';
import { ApiError, createApiClient } from '@vp/api-client';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';
import { UNAUTHORIZED } from './api-client';
import { DEFAULT_API_BASE_URL } from './parse-client-env';
import { requestSession } from './session-config';
import { occupiedSlots, readSessionToken } from './session-cookie';

/** How long one slot may take; a slower one shows no badge rather than hold the list. */
const GLANCE_TIMEOUT_MS = 1500;

/** The newest notifications read for the new comments count. */
const RECENT_LIMIT = 20;

/** What the switcher can say of another signed-in account without switching to it. */
export type AccountGlance =
  | {
      readonly slot: number;
      readonly state: 'counted';
      readonly unread: number;
      /** Unread comments on the account's channels among its newest notifications. */
      readonly newComments?: number;
    }
  | { readonly slot: number; readonly state: 'expired' }
  | { readonly slot: number; readonly state: 'unknown' };

async function glanceAt(apiBaseUrl: string, slot: number, token: string): Promise<AccountGlance> {
  const api = createApiClient({ baseUrl: apiBaseUrl, getAuthToken: () => token });
  const signal = AbortSignal.timeout(GLANCE_TIMEOUT_MS);
  const [count, recent] = await Promise.all([
    fromPromise(
      () => api.notifications.getUnreadNotificationCount({ signal }),
      (cause) => cause
    ),
    fromPromise(
      () => api.notifications.listNotifications({ query: { limit: RECENT_LIMIT }, signal }),
      (cause) => cause
    ),
  ]);
  if (!isOk(count)) {
    const expired = count.error instanceof ApiError && count.error.status === UNAUTHORIZED;
    return { slot, state: expired ? 'expired' : 'unknown' };
  }
  if (!isOk(recent)) return { slot, state: 'counted', unread: count.value.unreadCount };

  const newComments = recent.value.items.filter(
    (notification) => !notification.read && notification.kind === 'comment'
  ).length;
  return { slot, state: 'counted', unread: count.value.unreadCount, newComments };
}

/**
 * One call for every other signed-in account: each slot's unread count and new comments, asked in
 * parallel with its own token and 1.5 s each, so a slow or failing slot only loses its own badge
 * and a refused token marks its row expired. Server only; the browser never holds a token.
 */
export const glanceAccounts = createServerFn({ method: 'GET' })
  .validator(z.strictObject({ slot: AccountSlotSchema }))
  .handler(({ data }): Promise<AccountGlance[]> => {
    const { apiBaseUrl = DEFAULT_API_BASE_URL } = requestSession();
    const others = occupiedSlots().filter((slot) => slot !== data.slot);
    return Promise.all(
      others.map((slot) => {
        const token = readSessionToken(slot);
        return token === undefined
          ? Promise.resolve<AccountGlance>({ slot, state: 'expired' })
          : glanceAt(apiBaseUrl, slot, token);
      })
    );
  });
