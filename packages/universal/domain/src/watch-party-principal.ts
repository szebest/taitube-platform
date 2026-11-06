export const MEMBER_KINDS = ['user', 'discord', 'guest'] as const;
export type MemberKind = (typeof MEMBER_KINDS)[number];

/**
 * Who a seat belongs to. Every per-person row and budget in a room is keyed by its member key,
 * so a ban on `discord:<id>` holds whichever client that person arrives through.
 */
export type PartyPrincipal =
  | { readonly kind: 'user'; readonly userId: string }
  | {
      readonly kind: 'discord';
      readonly discordUserId: string;
      readonly name: string;
      readonly avatarUrl: string | null;
    }
  | { readonly kind: 'guest'; readonly guestId: string; readonly name: string };

export type MemberKey = `${MemberKind}:${string}`;

const ID_PATTERN: Readonly<Record<MemberKind, RegExp>> = {
  user: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  discord: /^\d{17,20}$/,
  guest: /^[A-Za-z0-9_-]{16,64}$/,
};

export function memberKeyOf(principal: PartyPrincipal): MemberKey {
  switch (principal.kind) {
    case 'user':
      return `user:${principal.userId}`;
    case 'discord':
      return `discord:${principal.discordUserId}`;
    case 'guest':
      return `guest:${principal.guestId}`;
  }
}

function isMemberKind(value: string): value is MemberKind {
  return (MEMBER_KINDS as readonly string[]).includes(value);
}

/** A member key from a path or a row, or `null` when it is not one. */
export function parseMemberKey(value: string): { kind: MemberKind; id: string } | null {
  const separator = value.indexOf(':');
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (separator === -1 || !isMemberKind(kind) || !ID_PATTERN[kind].test(id)) return null;
  return { kind, id };
}

const GUEST_DIGITS = { min: 1000, max: 9999 } as const;

/** "Guest 4821": generated, never chosen, so nobody can pose as someone else. */
export function guestName(digits: number): string {
  return `Guest ${digits}`;
}

/**
 * Four digits no other guest in the room holds, from `random` in [0, 1) and probing upward past
 * a taken one; `null` when every number is taken.
 */
export function pickGuestDigits(taken: ReadonlySet<number>, random: () => number): number | null {
  const span = GUEST_DIGITS.max - GUEST_DIGITS.min + 1;
  const start = Math.floor(random() * span);
  for (let step = 0; step < span; step += 1) {
    const digits = GUEST_DIGITS.min + ((start + step) % span);
    if (!taken.has(digits)) return digits;
  }
  return null;
}
