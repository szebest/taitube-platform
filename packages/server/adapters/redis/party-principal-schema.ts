import { z } from 'zod';

const UserPrincipal = z.object({ kind: z.literal('user'), userId: z.string() });
const DiscordPrincipal = z.object({
  kind: z.literal('discord'),
  discordUserId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});
const GuestPrincipal = z.object({
  kind: z.literal('guest'),
  guestId: z.string(),
  name: z.string(),
});

export const PartyPrincipalSchema = z.discriminatedUnion('kind', [
  UserPrincipal,
  DiscordPrincipal,
  GuestPrincipal,
]);

/** What a party credential holds: an account signs in through the app instead. */
export const PartyCredentialPrincipalSchema = z.discriminatedUnion('kind', [
  DiscordPrincipal,
  GuestPrincipal,
]);
