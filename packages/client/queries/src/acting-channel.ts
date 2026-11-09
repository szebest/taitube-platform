import { createIsomorphicFn } from '@tanstack/react-start';
import { ONE_YEAR_S, readCookie, writeCookie } from '@vp/ui';

/** The channel the studio last acted on, host-only: a preference the API checks against the caller's memberships on every call. */
export const ACTING_CHANNEL_COOKIE = 'vp.channel';

export type ActingChannelStore = {
  /** The channel the next channel-scoped call names; `undefined` is the caller's own. */
  read: () => string | undefined;
  select: (channelId: string | undefined) => void;
};

const persist = createIsomorphicFn()
  .server((_channelId: string | undefined) => undefined)
  .client((channelId: string | undefined) =>
    writeCookie(ACTING_CHANNEL_COOKIE, channelId ?? '', { maxAge: channelId ? ONE_YEAR_S : 0 })
  );

/** One per router, so no two requests share a channel; it starts from the cookie on first read. */
export function createActingChannelStore(): ActingChannelStore {
  let selected: { channelId: string | undefined } | undefined;

  return {
    read: () => {
      selected ??= { channelId: readCookie(ACTING_CHANNEL_COOKIE) || undefined };
      return selected.channelId;
    },
    select: (channelId) => {
      selected = { channelId };
      persist(channelId);
    },
  };
}
