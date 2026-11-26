import { isOk, parseJson } from '@kit/result';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';
import { type Identity, identityKey } from './account-slots';

const SLOT_COUNT = 10;
const LABEL_MAX_LENGTH = 40;
const LABEL_MAX_ENCODED = 90;
const AVATAR_MAX_LENGTH = 200;
const ACCENTS_MAX = 10;
const PINNED_MAX = 8;

/** What a browser keeps of one cookie, its name included; the slot list must fit all ten slots in it. */
const COOKIE_BYTES_MAX = 4096;
const ACCOUNTS_COOKIE_NAME_BYTES = 'vp.accounts='.length;

/** A channel handle (38's rules), the acting channel a slot last used. */
export const AccountChannelSchema = z.string().min(1).max(30);

const AccountEntrySchema = z.object({
  slot: AccountSlotSchema,
  userId: z.string(),
  label: z.string(),
  avatarUrl: z.string().max(AVATAR_MAX_LENGTH).nullable(),
  /** The channel handle the slot last acted as; `null` is the primary. */
  channel: AccountChannelSchema.nullable(),
  expired: z.boolean(),
});

/** The colours an identity's ring may take: the theme's categorical palette, `--dataviz-categorical-<n>`. */
export const ACCENTS = [1, 2, 3, 4, 5, 6] as const;

const AccentSchema = z.literal(ACCENTS);

export type Accent = z.infer<typeof AccentSchema>;

/** `identityKey`'s shape, bounded so the cookie stays inside its budget. */
const IdentityKeySchema = z.string().regex(/^\d\.[a-z0-9_.-]{1,30}$/);

const AccountsSchema = z.object({
  defaultSlot: AccountSlotSchema,
  slots: z.array(AccountEntrySchema).max(SLOT_COUNT),
  /** The accent each identity was given, by `identityKey`; an identity missing here takes its slot's. */
  accents: z
    .record(IdentityKeySchema, AccentSchema)
    .refine((accents) => Object.keys(accents).length <= ACCENTS_MAX)
    .optional(),
  /** The identities pinned to the top of the switcher, by `identityKey`, in the order shown. */
  pinned: z.array(IdentityKeySchema).max(PINNED_MAX).optional(),
});

/** One row of the slot list: enough to draw it while the slot is signed out or expired. */
type AccountEntry = z.infer<typeof AccountEntrySchema>;

/**
 * What `vp.accounts` holds: the slots this browser signed in, newest sign-in as the default for a
 * tab with no prefix. Not a secret and not the truth: which slots hold a session is which
 * `vp.session.<slot>` cookies the request carries.
 */
export type Accounts = z.infer<typeof AccountsSchema>;

export const NO_ACCOUNTS: Accounts = { defaultSlot: 0, slots: [] };

export function parseAccounts(raw: string | undefined): Accounts {
  if (raw === undefined) return NO_ACCOUNTS;
  const json = parseJson(raw);
  const parsed = isOk(json) ? AccountsSchema.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data : NO_ACCOUNTS;
}

function encodedLength(value: string): number {
  return encodeURIComponent(value).length;
}

/** The longest start of `label` whose cookie encoding fits, whatever script it is written in. */
function cutLabel(label: string): string {
  const characters = Array.from(label.replaceAll(/\p{Surrogate}/gu, '\u{FFFD}')).slice(
    0,
    LABEL_MAX_LENGTH
  );
  let cut = '';
  for (const character of characters) {
    if (encodedLength(cut + character) > LABEL_MAX_ENCODED) break;
    cut += character;
  }
  return cut;
}

/**
 * The slot list as the cookie carries it. Ten rows always fit the browser's cookie limit, because a
 * label and a handle are bounded; the avatar hints are the part that may not, so they are dropped
 * when they would push the cookie past it.
 */
export function serializeAccounts(accounts: Accounts): string {
  const whole = JSON.stringify(accounts);
  if (ACCOUNTS_COOKIE_NAME_BYTES + encodedLength(whole) <= COOKIE_BYTES_MAX) return whole;
  return JSON.stringify({
    ...accounts,
    slots: accounts.slots.map((entry) => ({ ...entry, avatarUrl: null })),
  });
}

export type SignedInAccount = Pick<AccountEntry, 'slot' | 'userId' | 'label' | 'avatarUrl'>;

/** The slot holds this account now, freshly signed in, and a new tab opens on it. */
export function withSignedIn(accounts: Accounts, account: SignedInAccount): Accounts {
  const entry: AccountEntry = {
    ...account,
    label: cutLabel(account.label),
    avatarUrl:
      account.avatarUrl && account.avatarUrl.length <= AVATAR_MAX_LENGTH ? account.avatarUrl : null,
    channel: null,
    expired: false,
  };
  return {
    ...accounts,
    defaultSlot: account.slot,
    slots: [...accounts.slots.filter(({ slot }) => slot !== account.slot), entry].toSorted(
      (a, b) => a.slot - b.slot
    ),
  };
}

/** The slot's session ended on its own: the row stays, marked for a re-auth. */
export function withExpired(accounts: Accounts, expiredSlot: number): Accounts {
  return {
    ...accounts,
    slots: accounts.slots.map((entry) =>
      entry.slot === expiredSlot ? { ...entry, expired: true } : entry
    ),
  };
}

const ofSlot = (slot: number) => (key: string) => key.startsWith(`${slot}.`);

/** The slot signed out: its row, accents and pins go, and the default moves to the first slot left. */
export function withoutSlot(accounts: Accounts, removed: number): Accounts {
  const slots = accounts.slots.filter(({ slot }) => slot !== removed);
  const defaultSlot =
    accounts.defaultSlot === removed ? (slots[0]?.slot ?? 0) : accounts.defaultSlot;
  const removedKey = ofSlot(removed);
  const accents = Object.entries(accounts.accents ?? {}).filter(([key]) => !removedKey(key));
  const pinned = (accounts.pinned ?? []).filter((key) => !removedKey(key));
  return { defaultSlot, slots, accents: Object.fromEntries(accents), pinned };
}

/** The ring an identity wears: the accent picked for it, else one its slot gives it. */
export function accentOf(accounts: Accounts, identity: Identity): Accent {
  return accounts.accents?.[identityKey(identity)] ?? ACCENTS[identity.slot % ACCENTS.length] ?? 1;
}

/** The identity wears `accent` from now on; past the cap the oldest choice gives way. */
export function withAccent(accounts: Accounts, identity: Identity, accent: Accent): Accounts {
  const key = identityKey(identity);
  const others = Object.entries(accounts.accents ?? {}).filter(([kept]) => kept !== key);
  return {
    ...accounts,
    accents: Object.fromEntries([...others, [key, accent]].slice(-ACCENTS_MAX)),
  };
}

/** The pinned identities, in this order, the first `PINNED_MAX` of them. */
export function withPinned(accounts: Accounts, pinned: readonly Identity[]): Accounts {
  const keys = [...new Set(pinned.map(identityKey))];
  return { ...accounts, pinned: keys.slice(0, PINNED_MAX) };
}

/** A tab switched to this identity, which a new tab with no prefix opens as. */
export function withDefault(accounts: Accounts, slot: number, channel: string | null): Accounts {
  return {
    ...accounts,
    defaultSlot: slot,
    slots: accounts.slots.map((entry) => (entry.slot === slot ? { ...entry, channel } : entry)),
  };
}

/** The slot this user's row is in, signed in or expired, so one user never holds two. */
export function slotOfUser(accounts: Accounts, userId: string): number | undefined {
  return accounts.slots.find((entry) => entry.userId === userId)?.slot;
}

/**
 * Where an added account goes, under the browser's cap of sessions: the lowest slot with neither a
 * session nor a row, else the lowest whose row lost its session (that row is replaced), else none.
 */
export function firstFreeSlot(
  accounts: Accounts,
  occupied: readonly number[],
  accountsMax: number
): number | undefined {
  if (occupied.length >= accountsMax) return undefined;
  const listed = new Set(accounts.slots.map(({ slot }) => slot));
  const free = Array.from({ length: accountsMax }, (_, slot) => slot).filter(
    (slot) => !occupied.includes(slot)
  );
  return free.find((slot) => !listed.has(slot)) ?? free[0];
}

/** The slot a request with no prefix acts as: the default while it holds a session, else the lowest that does. */
export function defaultSlotOf(accounts: Accounts, occupied: readonly number[]): number {
  if (occupied.includes(accounts.defaultSlot)) return accounts.defaultSlot;
  return occupied.toSorted((a, b) => a - b)[0] ?? 0;
}
