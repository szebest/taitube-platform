import { PartyCredentialPrincipalSchema, PartyPrincipalSchema } from '../party-principal-schema';

const USER = { kind: 'user', userId: 'u1' };
const GUEST = { kind: 'guest', guestId: 'g1', name: 'Guest 4821' };
const DISCORD = { kind: 'discord', discordUserId: '1', name: 'Ana', avatarUrl: null };

describe('party principal schemas', () => {
  it.each([
    { kind: 'an account', principal: USER, credential: false },
    { kind: 'a guest', principal: GUEST, credential: true },
    { kind: 'a Discord member', principal: DISCORD, credential: true },
    { kind: 'an unknown kind', principal: { kind: 'bot' }, credential: false },
  ])('reads $kind for a credential: $credential', ({ principal, credential }) => {
    expect(PartyCredentialPrincipalSchema.safeParse(principal).success).toBe(credential);
  });

  it.each([
    { kind: 'an account', principal: USER, valid: true },
    { kind: 'a guest', principal: GUEST, valid: true },
    { kind: 'a Discord member', principal: DISCORD, valid: true },
    { kind: 'a guest without a name', principal: { kind: 'guest', guestId: 'g1' }, valid: false },
    { kind: 'an unknown kind', principal: { kind: 'bot' }, valid: false },
  ])('reads $kind in a socket token: $valid', ({ principal, valid }) => {
    expect(PartyPrincipalSchema.safeParse(principal).success).toBe(valid);
  });
});
