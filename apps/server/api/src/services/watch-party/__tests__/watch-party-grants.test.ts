import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { claimGrant, findGrant, joinGrantOf, settleGrant } from '../watch-party-grants';
import { seedInvite, seedLink } from './watch-party-access-fixture';
import { MEMBER, OTHER, seedParty, startParty, watchPartyTestDeps } from './watch-party-test-deps';

async function setUpGrants() {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const room = await startParty(test, { visibility: 'private' });
  const other = await startParty(test, { visibility: 'private' });
  const find = (invite: string | undefined, userId: string | null = MEMBER.id, roomId = room.id) =>
    findGrant(test.deps, { roomId, userId, invite });
  return { ...test, room, other, find };
}

describe('apps/server/api/services: findGrant', () => {
  it('finds no grant where nothing was presented', async () => {
    const { find } = await setUpGrants();

    expect(expectOk(await find(undefined))).toEqual({ type: 'none' });
  });

  it('finds the caller’s own pending invite by its id', async () => {
    const test = await setUpGrants();
    const invite = await seedInvite(test, test.room.id, MEMBER);

    expect(expectOk(await test.find(invite.id))).toEqual({ type: 'invite', inviteId: invite.id });
  });

  it('finds a link by its token', async () => {
    const test = await setUpGrants();
    const token = await seedLink(test, test.room.id);

    expect(expectOk(await test.find(token, null))).toEqual({
      type: 'link',
      linkId: expect.any(String),
    });
  });

  it.each([
    { scenario: 'an invite meant for someone else', who: OTHER.id },
    { scenario: 'an invite presented without an account', who: null },
  ])('finds nothing in $scenario', async ({ who }) => {
    const test = await setUpGrants();
    const invite = await seedInvite(test, test.room.id, MEMBER);

    expect(expectOk(await test.find(invite.id, who))).toEqual({ type: 'invalid' });
  });

  it.each([
    { scenario: 'revoked', link: { revokedAt: new Date(0) } },
    { scenario: 'expired', link: { expiresAt: new Date(0) } },
    { scenario: 'spent', link: { maxUses: 3, uses: 3 } },
  ])('finds nothing in a $scenario link', async ({ link }) => {
    const test = await setUpGrants();
    const token = await seedLink(test, test.room.id, link);

    expect(expectOk(await test.find(token))).toEqual({ type: 'invalid' });
  });

  it.each([
    { scenario: 'a link of another room', own: false },
    { scenario: 'a token nobody issued', own: true, token: 'never-issued' },
  ])('grants nothing for $scenario', async ({ own, token }) => {
    const test = await setUpGrants();
    const issued = own ? undefined : await seedLink(test, test.other.id);

    expect(expectOk(await test.find(token ?? issued))).toEqual({ type: 'invalid' });
  });

  it.each([
    { grant: { type: 'none' } as const, joined: null },
    { grant: { type: 'invalid' } as const, joined: 'invalid' },
    { grant: { type: 'invite', inviteId: 'i' } as const, joined: 'invite' },
    { grant: { type: 'link', linkId: 'l' } as const, joined: 'invite_link' },
  ])('reads $grant.type as $joined for the join rule', ({ grant, joined }) => {
    expect(joinGrantOf(grant)).toBe(joined);
  });
});

describe('apps/server/api/services: claiming and settling a grant', () => {
  it('counts a link use, and answers invalid once a racing join took the last one', async () => {
    const test = await setUpGrants();
    const token = await seedLink(test, test.room.id, { maxUses: 1 });
    const grant = expectOk(await test.find(token, null));

    expectOk(await claimGrant(test.deps, test.room.id, grant));

    expect(expectErr(await claimGrant(test.deps, test.room.id, grant)).code).toBe(
      ErrorCodes.WATCH_PARTY_INVITE_INVALID
    );
  });

  it('marks an invite joined once the seat is held', async () => {
    const test = await setUpGrants();
    const invite = await seedInvite(test, test.room.id, MEMBER);

    expectOk(await settleGrant(test.deps, { type: 'invite', inviteId: invite.id }));

    expect(expectOk(await test.repositories.watchPartyInvites.findById(invite.id))?.status).toBe(
      'joined'
    );
  });

  it.each([{ type: 'none' as const }, { type: 'invalid' as const }])(
    'has nothing to claim or settle in a $type grant',
    async (grant) => {
      const test = await setUpGrants();

      expectOk(await claimGrant(test.deps, test.room.id, grant));
      expectOk(await settleGrant(test.deps, grant));
    }
  );
});
