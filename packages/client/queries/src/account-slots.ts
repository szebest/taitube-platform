import { isOk, ok, tryCatch } from '@kit/result';
import { AccountSlotSchema } from '@vp/api-contracts';

/** Names the slot a proxied call acts for; a custom header, so no cross-site form can send it. */
export const ACCOUNT_SLOT_HEADER = 'x-account-slot';

/** What a tab acts as: an account's slot in this browser, and the channel (its handle) when not the primary. */
export type Identity = { readonly slot: number; readonly channel?: string };

export type IdentityPath = {
  /** The identity the path names, or `undefined` for an unprefixed path. */
  readonly identity: Identity | undefined;
  /** The path the routes match, without the prefix. */
  readonly pathname: string;
};

const IDENTITY_PREFIX = /^\/u\/(\d)(?:\/c\/([^/]+))?(?=\/|$)/;

const UNPREFIXED_PATHS: ReadonlySet<string> = new Set(['/login']);

export function parseSlot(value: string | null | undefined): number | undefined {
  const parsed = AccountSlotSchema.safeParse(value ? Number(value) : undefined);
  return parsed.success ? parsed.data : undefined;
}

/** Splits `/u/<slot>[/c/<handle>]` off the front of `pathname`. */
export function parseIdentityPath(pathname: string): IdentityPath {
  const match = IDENTITY_PREFIX.exec(pathname);
  const slot = parseSlot(match?.[1]);
  if (!match || slot === undefined) return { identity: undefined, pathname };

  const [, , handle] = match;
  const channel = handle
    ? tryCatch(
        () => decodeURIComponent(handle),
        (cause) => cause
      )
    : ok(undefined);
  if (!isOk(channel)) return { identity: undefined, pathname };
  return {
    identity: channel.value ? { slot, channel: channel.value } : { slot },
    pathname: pathname.slice(match[0].length) || '/',
  };
}

/** `pathname` under the identity's prefix; `/login` and a missing identity stay as they are. */
export function identityPath(identity: Identity | undefined, pathname: string): string {
  if (!identity || UNPREFIXED_PATHS.has(pathname)) return pathname;

  const channel = identity.channel ? `/c/${encodeURIComponent(identity.channel)}` : '';
  return `/u/${identity.slot}${channel}${pathname === '/' ? '' : pathname}`;
}

/** One string per identity, for a cache, a stream or an ability that must never outlive it. */
export function identityKey({ slot, channel }: Identity): string {
  return `${slot}.${channel ?? 'primary'}`;
}

/**
 * A link into the other client app (web from the studio, the studio from web) that keeps this
 * tab's identity, so the page opens as the same account and channel; a one-account browser's
 * carries no prefix.
 */
export function appLink(
  origin: string,
  path: string,
  { identity, prefixed }: { identity: Identity; prefixed: boolean }
): string {
  const url = new URL(path, origin);
  const pathname = identityPath(prefixed ? identity : undefined, url.pathname);
  return `${url.origin}${pathname === '/' ? '' : pathname}${url.search}${url.hash}`;
}
