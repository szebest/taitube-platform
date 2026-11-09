import { randomUUID } from 'node:crypto';
import type { PartyGuestSession, PartyGuestSessionsPort } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface PartyGuestSessionsSubject {
  readonly sessions: PartyGuestSessionsPort;
  close(): Promise<void>;
}

const TTL_SECONDS = 3600;

const GUEST: PartyGuestSession = {
  principal: { kind: 'guest', guestId: 'g'.repeat(24), name: 'Guest 4821' },
  ipHash: 'a1b2c3',
};

const DISCORD: PartyGuestSession = {
  principal: {
    kind: 'discord',
    discordUserId: '123456789012345678',
    name: 'Ana',
    avatarUrl: 'http://localhost:9000/public/ana.png',
  },
  ipHash: null,
};

export function describePartyGuestSessionsContract(
  makeSubject: () => Promise<PartyGuestSessionsSubject>
) {
  describe('PartyGuestSessions contract', () => {
    let subject: PartyGuestSessionsSubject;
    let credential: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      credential = randomUUID();
    });

    const resolve = async (token = credential) =>
      expectOk(await subject.sessions.resolve(token, TTL_SECONDS));

    it.each([
      { kind: 'a guest', session: GUEST },
      { kind: 'a Discord member', session: DISCORD },
    ])('resolves the credential of $kind to what was issued', async ({ session }) => {
      expectOk(await subject.sessions.issue(credential, session, TTL_SECONDS));

      expect(await resolve()).toEqual(session);
      expect(await resolve()).toEqual(session);
    });

    it('resolves nothing for a credential nobody issued', async () => {
      expect(await resolve()).toBeNull();
    });

    it('resolves nothing once revoked, and revokes only that credential', async () => {
      const other = randomUUID();
      expectOk(await subject.sessions.issue(credential, GUEST, TTL_SECONDS));
      expectOk(await subject.sessions.issue(other, DISCORD, TTL_SECONDS));

      expectOk(await subject.sessions.revoke(credential));

      expect(await resolve()).toBeNull();
      expect(await resolve(other)).toEqual(DISCORD);
    });
  });
}
