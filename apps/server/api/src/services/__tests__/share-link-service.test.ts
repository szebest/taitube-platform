import type { Result } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { MAX_ACTIVE_SHARE_LINKS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { ShareLinkService } from '../share-link-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000001a1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000001a2', role: 'USER' };
const VIDEO = '00000000-0000-7000-8000-0000000001a3';
const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const HOUR = 3_600_000;

describe('apps/server/api/services: ShareLinkService', () => {
  let repositories: InMemoryRepositories;
  let service: ShareLinkService;
  let clock: number;
  let tokens: number;
  let ids: number;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    clock = NOW;
    tokens = 0;
    ids = 0;
    service = new ShareLinkService({
      videos: repositories.videos,
      shareLinks: repositories.shareLinks,
      newToken: () => `token-${String((tokens += 1)).padStart(16, '0')}`,
      newId: () => `00000000-0000-7000-8000-00000001${String((ids += 1)).padStart(4, '0')}`,
      now: () => clock,
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER.id,
        title: 'Shared',
        visibility: 'private',
        status: 'READY',
        sourceKey: `raw/${VIDEO}.mp4`,
      })
    );
  });

  it('creates a link with its expiry and label, and lists it with zero numbers', async () => {
    const created = expectOk(
      await service.create(OWNER, VIDEO, { label: '  Press  ', expiresIn: '24h' })
    );

    expect(created).toEqual({
      id: '00000000-0000-7000-8000-000000010001',
      token: 'token-0000000000000001',
      label: 'Press',
      expiresAt: new Date(NOW + 24 * HOUR).toISOString(),
      revokedAt: null,
      createdAt: new Date(NOW).toISOString(),
      state: 'active',
      stats: { opens: 0, views: 0, watchSeconds: 0 },
    });
    expect(expectOk(await service.list(OWNER, VIDEO)).items).toEqual([created]);
  });

  it('lists an expired and a revoked link by their state', async () => {
    const expiring = expectOk(await service.create(OWNER, VIDEO, { expiresIn: '1h' }));
    const revoked = expectOk(await service.create(OWNER, VIDEO, { expiresIn: 'never' }));
    expectOk(await service.revoke(OWNER, VIDEO, revoked.id));
    clock = NOW + 2 * HOUR;

    const states = expectOk(await service.list(OWNER, VIDEO)).items.map(({ id, state }) => [
      id,
      state,
    ]);

    expect(states).toEqual(
      expect.arrayContaining([
        [expiring.id, 'expired'],
        [revoked.id, 'revoked'],
      ])
    );
  });

  it('refuses a link past the active limit, and counts only the active ones', async () => {
    for (let index = 0; index < MAX_ACTIVE_SHARE_LINKS; index += 1) {
      expectOk(await service.create(OWNER, VIDEO, { expiresIn: '1h' }));
    }

    expect(expectErr(await service.create(OWNER, VIDEO, { expiresIn: '1h' })).code).toBe(
      ErrorCodes.SHARE_LINK_LIMIT
    );
    clock = NOW + 2 * HOUR;
    expectOk(await service.create(OWNER, VIDEO, { expiresIn: '1h' }));
  });

  it('refuses a label over 60 characters', async () => {
    expect(
      expectErr(await service.create(OWNER, VIDEO, { label: 'x'.repeat(61), expiresIn: '1h' })).code
    ).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('answers a revoke of a link the video does not hold with SHARE_LINK_NOT_FOUND', async () => {
    expect(expectErr(await service.revoke(OWNER, VIDEO, VIDEO)).code).toBe(
      ErrorCodes.SHARE_LINK_NOT_FOUND
    );
  });

  it.each([
    { action: 'list', run: (s: ShareLinkService) => s.list(STRANGER, VIDEO) },
    {
      action: 'create',
      run: (s: ShareLinkService) => s.create(STRANGER, VIDEO, { expiresIn: '1h' }),
    },
    { action: 'revoke', run: (s: ShareLinkService) => s.revoke(STRANGER, VIDEO, VIDEO) },
  ])('answers a stranger who would $action as if the video were absent', async ({ run }) => {
    const refused: Result<unknown, { code: string }> = await run(service);

    expect(expectErr(refused).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });
});
