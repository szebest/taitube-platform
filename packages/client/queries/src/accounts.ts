import { isOk, parseJson } from '@kit/result';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';

const SLOT_COUNT = 10;
const LABEL_MAX_LENGTH = 40;
const LABEL_MAX_ENCODED = 90;
const AVATAR_MAX_LENGTH = 200;

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

const AccountsSchema = z.object({
  defaultSlot: AccountSlotSchema,
  slots: z.array(AccountEntrySchema).max(SLOT_COUNT),
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

/** The slot signed out: its row goes, and the default moves to the first slot left. */
export function withoutSlot(accounts: Accounts, removed: number): Accounts {
  const slots = accounts.slots.filter(({ slot }) => slot !== removed);
  const defaultSlot =
    accounts.defaultSlot === removed ? (slots[0]?.slot ?? 0) : accounts.defaultSlot;
  return { defaultSlot, slots };
}

/** A tab switched to this identity, which a new tab with no prefix opens as. */
export function withDefault(accounts: Accounts, slot: number, channel: string | null): Accounts {
  return {
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
