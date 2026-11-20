import type { IdentitiesView } from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import type { AccountGlance } from '../account-glance';
import { type Identity, identityKey } from '../account-slots';
import { type Accent, type Accounts, accentOf } from '../accounts';

/** One row of the switcher: an account (acting as its primary channel), another owned channel, or a team. */
export type IdentityEntry = {
  readonly identity: Identity;
  readonly key: string;
  readonly kind: 'account' | 'channel' | 'team';
  readonly name: string;
  /** The channel's handle; another account's row knows none until it is switched to. */
  readonly handle: string | undefined;
  readonly avatarUrl: string | null;
  readonly accent: Accent;
  readonly role: ChannelRole | undefined;
  readonly expired: boolean;
  readonly current: boolean;
  readonly pinned: boolean;
  /** What waits on another account, when the overview answered for it. */
  readonly glance: AccountGlance | undefined;
};

export type IdentityEntrySources = {
  accounts: Accounts;
  /** The identity this tab acts as. */
  tab: Identity;
  /** `GET /v1/me/identities` of the tab's account, once loaded. */
  mine: IdentitiesView | undefined;
  glances: readonly AccountGlance[] | undefined;
};

type EntryFields = Omit<IdentityEntry, 'key' | 'accent' | 'current' | 'pinned'>;

function entryOf(fields: EntryFields, { accounts, tab }: IdentityEntrySources): IdentityEntry {
  const key = identityKey(fields.identity);
  return {
    ...fields,
    key,
    accent: accentOf(accounts, fields.identity),
    current: key === identityKey(tab),
    pinned: (accounts.pinned ?? []).includes(key),
  };
}

function ownIdentities(sources: IdentityEntrySources): EntryFields[] {
  const { slot } = sources.tab;
  const row = sources.accounts.slots.find((entry) => entry.slot === slot);
  const owned = sources.mine?.owned ?? [];
  const primary = owned.find((channel) => channel.isPrimary);
  const base = { expired: false, glance: undefined, role: undefined };
  const account: EntryFields = {
    ...base,
    identity: { slot },
    kind: 'account',
    name: primary?.displayName ?? row?.label ?? '',
    handle: primary?.handle,
    avatarUrl: primary?.avatarUrl ?? row?.avatarUrl ?? null,
  };
  const channels = owned
    .filter((channel) => !channel.isPrimary)
    .map((channel): EntryFields => ({
      ...base,
      identity: { slot, channel: channel.handle },
      kind: 'channel',
      name: channel.displayName,
      handle: channel.handle,
      avatarUrl: channel.avatarUrl,
    }));
  const teams = (sources.mine?.member ?? []).map((channel): EntryFields => ({
    ...base,
    identity: { slot, channel: channel.handle },
    kind: 'team',
    name: channel.displayName,
    handle: channel.handle,
    avatarUrl: channel.avatarUrl,
    role: channel.role,
  }));
  return [account, ...channels, ...teams];
}

function otherAccount(
  { slot, label, avatarUrl, expired }: Accounts['slots'][number],
  glances: IdentityEntrySources['glances']
): EntryFields {
  const glance = glances?.find((entry) => entry.slot === slot);
  return {
    identity: { slot },
    kind: 'account',
    name: label,
    handle: undefined,
    avatarUrl,
    role: undefined,
    expired: expired || glance?.state === 'expired',
    glance,
  };
}

/**
 * Every identity the switcher offers, in its order: the pinned ones first as they were pinned, then
 * each account by slot, the tab's own with its other channels and its teams under it.
 */
export function identityEntries(sources: IdentityEntrySources): IdentityEntry[] {
  const { slot } = sources.tab;
  const slots = [...new Set([slot, ...sources.accounts.slots.map((entry) => entry.slot)])].toSorted(
    (a, b) => a - b
  );
  const listed = slots.flatMap((each) => {
    if (each === slot) return ownIdentities(sources);
    const row = sources.accounts.slots.find((entry) => entry.slot === each);
    return row ? [otherAccount(row, sources.glances)] : [];
  });
  const entries = listed.map((fields) => entryOf(fields, sources));
  const pinned = sources.accounts.pinned ?? [];
  return [
    ...pinned.flatMap((key) => entries.filter((entry) => entry.key === key)),
    ...entries.filter((entry) => !entry.pinned),
  ];
}
