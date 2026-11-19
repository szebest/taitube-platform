import { isOk, parseJson } from '@kit/result';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';

const SLOT_COUNT = 10;
const LABEL_MAX_LENGTH = 40;
const AVATAR_MAX_LENGTH = 200;

const AccountEntrySchema = z.object({
  slot: AccountSlotSchema,
  userId: z.string(),
  label: z.string().max(LABEL_MAX_LENGTH),
  avatarUrl: z.string().max(AVATAR_MAX_LENGTH).nullable(),
  /** The channel handle the slot last acted as; `null` is the primary. */
  channel: z.string().nullable(),
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

export type SignedInAccount = Pick<AccountEntry, 'slot' | 'userId' | 'label' | 'avatarUrl'>;

/** The slot holds this account now, freshly signed in, and a new tab opens on it. */
export function withSignedIn(accounts: Accounts, account: SignedInAccount): Accounts {
  const entry: AccountEntry = {
    ...account,
    label: account.label.slice(0, LABEL_MAX_LENGTH),
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

/** The slot holding this user's session, so one user never holds two. */
export function slotOfUser(
  accounts: Accounts,
  userId: string,
  occupied: readonly number[]
): number | undefined {
  return accounts.slots.find((entry) => entry.userId === userId && occupied.includes(entry.slot))
    ?.slot;
}

/** The lowest slot with no session, under the browser's cap. */
export function firstFreeSlot(
  occupied: readonly number[],
  accountsMax: number
): number | undefined {
  if (occupied.length >= accountsMax) return undefined;
  return Array.from({ length: accountsMax }, (_, slot) => slot).find(
    (slot) => !occupied.includes(slot)
  );
}

/** The slot a request with no prefix acts as: the default while it holds a session, else the lowest that does. */
export function defaultSlotOf(accounts: Accounts, occupied: readonly number[]): number {
  if (occupied.includes(accounts.defaultSlot)) return accounts.defaultSlot;
  return occupied.toSorted((a, b) => a - b)[0] ?? 0;
}
