import { fromPromise, isOk } from '@kit/result';
import { createServerFn } from '@tanstack/react-start';
import { createApiClient } from '@vp/api-client';
import { z } from 'zod';
import { type Identity, identityPath } from '../account-slots';
import { AccountChannelSchema } from '../accounts';
import { readAccounts } from '../accounts-cookie';
import { DEFAULT_API_BASE_URL } from '../parse-client-env';
import { requestSession } from '../session-config';
import { occupiedSlots, readSessionToken } from '../session-cookie';

/** How long one slot may take to say which channels it acts as. */
const LOOKUP_TIMEOUT_MS = 1500;

async function identityIn(
  apiBaseUrl: string,
  slot: number,
  handle: string
): Promise<Identity | undefined> {
  const token = readSessionToken(slot);
  if (token === undefined) return undefined;
  const api = createApiClient({ baseUrl: apiBaseUrl, getAuthToken: () => token });
  const listed = await fromPromise(
    () => api.myChannels.listMyIdentities({ signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) }),
    (cause) => cause
  );
  if (!isOk(listed)) return undefined;
  const { owned, member } = listed.value;
  const own = owned.find((channel) => channel.handle === handle);
  if (own) return own.isPrimary ? { slot } : { slot, channel: handle };
  return member.some((channel) => channel.handle === handle)
    ? { slot, channel: handle }
    : undefined;
}

/**
 * Where the studio opens for the channel `handle`: as the identity this browser last used it as,
 * else as the first slot whose account owns it or works on its team, asked in parallel; the path
 * carries that identity's prefix, and `undefined` means no account here can act as it.
 */
export const studioPathForChannel = createServerFn({ method: 'GET' })
  .validator(z.strictObject({ handle: AccountChannelSchema, next: z.string().startsWith('/') }))
  .handler(async ({ data: { handle, next } }): Promise<string | undefined> => {
    const occupied = occupiedSlots();
    const recorded = readAccounts().slots.find(
      (entry) => entry.channel === handle && occupied.includes(entry.slot)
    );
    const { apiBaseUrl = DEFAULT_API_BASE_URL } = requestSession();
    const identity: Identity | undefined = recorded
      ? { slot: recorded.slot, channel: handle }
      : (await Promise.all(occupied.map((slot) => identityIn(apiBaseUrl, slot, handle)))).find(
          (found) => found !== undefined
        );
    if (!identity) return undefined;
    const prefixed = occupied.length > 1 || identity.channel !== undefined;
    return identityPath(prefixed ? identity : undefined, next);
  });
