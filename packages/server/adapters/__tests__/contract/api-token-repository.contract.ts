import { expectOk } from '@kit/testing/result';
import type { ApiTokenRepositoryPort } from '@vp/core/repositories';
import type { ApiToken, Channel } from '@vp/domain';
import { seedTeam } from './channel-team-fixtures';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const tokenId = (n: number) => `00000000-0000-7000-8000-00000000ea${String(n).padStart(2, '0')}`;

const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-04-01T00:00:00.000Z');

function token(channel: Channel, n: number, overrides: Partial<ApiToken> = {}): ApiToken {
  return {
    id: tokenId(n),
    userId: OWNER_ID,
    channelId: channel.id,
    name: `token ${n}`,
    prefix: `0000000${n}`,
    secretHash: `hash-${n}`,
    scopes: ['videos:read', 'analytics:read'],
    expiresAt: LATER,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(NOW.getTime() - (10 - n) * 60_000),
    ...overrides,
  };
}

export function describeApiTokenRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ApiTokenRepository contract', () => {
    let subject: RepositoriesSubject;
    let tokens: ApiTokenRepositoryPort;
    let channel: Channel;

    const save = async (...rows: ApiToken[]) => {
      for (const row of rows) expectOk(await tokens.create(row));
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      channel = await seedTeam(subject.repositories);
      tokens = subject.repositories.apiTokens;
    });

    it('lists the unrevoked tokens of one user newest first, without their hash', async () => {
      await save(
        token(channel, 1),
        token(channel, 2),
        token(channel, 3, { revokedAt: NOW }),
        token(channel, 4, { userId: OTHER_OWNER_ID })
      );

      const listed = expectOk(await tokens.listByUser(OWNER_ID, NOW));

      expect(listed.map((row) => row.id)).toEqual([tokenId(2), tokenId(1)]);
      const { secretHash: _hash, ...shown } = token(channel, 2);
      expect(listed[0]).toEqual({ ...shown, requestsToday: 0 });
    });

    it('counts the tokens that are neither revoked nor expired', async () => {
      await save(
        token(channel, 1),
        token(channel, 2, { expiresAt: NOW }),
        token(channel, 3, { revokedAt: NOW }),
        token(channel, 4, { userId: OTHER_OWNER_ID })
      );

      expect(expectOk(await tokens.countActive(OWNER_ID, NOW))).toBe(1);
    });

    it('finds a token of the user, revoked or not, and none of another user', async () => {
      await save(token(channel, 1, { revokedAt: NOW }));

      expect(expectOk(await tokens.findOwned(OWNER_ID, tokenId(1)))).toEqual(
        token(channel, 1, { revokedAt: NOW })
      );
      expect(expectOk(await tokens.findOwned(OTHER_OWNER_ID, tokenId(1)))).toBeNull();
    });

    it('revokes once, and only for its user', async () => {
      await save(token(channel, 1));

      expect(expectOk(await tokens.revoke(OTHER_OWNER_ID, tokenId(1), NOW))).toBe(false);
      expect(expectOk(await tokens.revoke(OWNER_ID, tokenId(1), NOW))).toBe(true);
      expect(expectOk(await tokens.revoke(OWNER_ID, tokenId(1), LATER))).toBe(false);
      expect(expectOk(await tokens.findOwned(OWNER_ID, tokenId(1)))?.revokedAt).toEqual(NOW);
    });

    it('finds every row with a prefix, whatever its state, with its user role', async () => {
      await save(
        token(channel, 1),
        token(channel, 2, { prefix: '00000001', revokedAt: NOW }),
        token(channel, 3)
      );

      const found = expectOk(await tokens.findByPrefix('00000001'));

      expect(found.map(({ token: row }) => row.id).sort()).toEqual([tokenId(1), tokenId(2)]);
      expect(found.map(({ userRole }) => userRole)).toEqual(['USER', 'USER']);
      expect(expectOk(await tokens.findByPrefix('ffffffff'))).toEqual([]);
    });

    it('records a use: the last time and one more request on that UTC day', async () => {
      await save(token(channel, 1));
      const evening = new Date('2026-03-01T23:59:00.000Z');
      const nextDay = new Date('2026-03-02T00:01:00.000Z');

      expectOk(await tokens.recordUse(tokenId(1), NOW));
      expectOk(await tokens.recordUse(tokenId(1), evening));
      expectOk(await tokens.recordUse(tokenId(1), nextDay));

      const [today] = expectOk(await tokens.listByUser(OWNER_ID, NOW));
      const [tomorrow] = expectOk(await tokens.listByUser(OWNER_ID, nextDay));
      expect(today).toMatchObject({ lastUsedAt: nextDay, requestsToday: 2 });
      expect(tomorrow).toMatchObject({ requestsToday: 1 });
    });

    it('lets the channel audit log name the token a write was made with, until it is gone', async () => {
      await save(token(channel, 1));
      const entry = {
        channelId: channel.id,
        actorUserId: OWNER_ID,
        actorTokenId: tokenId(1),
        action: 'export.requested',
        targetType: 'export',
        targetId: tokenId(9),
        meta: { kind: 'comments', format: 'csv' },
      } as const;

      expect(expectOk(await subject.repositories.channelAudit.append(entry))).toMatchObject({
        actorUserId: OWNER_ID,
        actorTokenId: tokenId(1),
      });
    });
  });
}
