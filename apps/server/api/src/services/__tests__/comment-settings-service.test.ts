import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { CommentSettingsView } from '@vp/api-contracts';
import { type ActingChannel, type ChannelRole, DEFAULT_COMMENT_SETTINGS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { CommentSettingsService } from '../comment-settings-service';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const MEMBER: UserContext = { id: '22222222-2222-7222-8222-222222222222', role: 'USER' };

const view = (changes: Partial<CommentSettingsView> = {}): CommentSettingsView => ({
  ...DEFAULT_COMMENT_SETTINGS,
  blockedWords: [],
  linkAllowlist: [],
  ...changes,
});

describe('apps/server/api/services: comment settings', () => {
  let repositories: InMemoryRepositories;
  let service: CommentSettingsService;
  let channelId: string;

  const acting = (role: ActingChannel['role']): ActingChannel => ({
    channelId,
    ownerId: OWNER.id,
    role,
  });
  const as = (role: ChannelRole): UserContext => ({
    ...MEMBER,
    memberships: { [channelId]: { role, ownerId: OWNER.id } },
  });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new CommentSettingsService({ settings: repositories.commentSettings });
    channelId = expectOk(
      await repositories.channels.create({
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    ).id;
  });

  it.each<{ role: ChannelRole; allowed: boolean }>([
    { role: 'manager', allowed: true },
    { role: 'moderator', allowed: false },
    { role: 'editor', allowed: false },
    { role: 'analytics', allowed: false },
  ])('lets a $role read and replace them: $allowed', async ({ role, allowed }) => {
    const user = as(role);

    const read = await service.get(user, acting(role));
    const write = await service.update(user, acting(role), view({ subscribersOnly: true }));

    expect([read.ok, write.ok]).toEqual([allowed, allowed]);
    if (!allowed) expect(expectErr(write).code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('stores the normalised words and hosts and answers them', async () => {
    const saved = expectOk(
      await service.update(
        OWNER,
        acting('owner'),
        view({ blockedWords: ['Spoiler', 'spoiler', ' cafe '], linkAllowlist: ['Example.com'] })
      )
    );

    expect(saved.blockedWords).toEqual(['Spoiler', 'cafe']);
    expect(saved.linkAllowlist).toEqual(['example.com']);
    expect(expectOk(await service.get(OWNER, acting('owner')))).toEqual(saved);
  });

  it('names each field that changed in the audit row, and writes none for a repeat', async () => {
    const changed = view({
      reviewMode: 'all',
      disclosure: { ...DEFAULT_COMMENT_SETTINGS.disclosure, hide: 'visible' },
    });

    expectOk(await service.update(OWNER, acting('owner'), changed));
    expectOk(await service.update(OWNER, acting('owner'), changed));

    const log = expectOk(
      await repositories.channelAudit.list(channelId, { cursor: null, limit: 10 })
    );
    expect(log.map(({ meta }) => meta)).toEqual([{ fields: ['reviewMode', 'disclosure'] }]);
  });

  it.each([
    { scenario: 'a blocked word that is too short', changes: { blockedWords: ['a'] } },
    { scenario: 'a slow mode that is no preset', changes: { slowModeSeconds: 7 } },
  ])('refuses $scenario and keeps what was saved', async ({ changes }) => {
    const failure = expectErr(await service.update(OWNER, acting('owner'), view(changes)));

    expect(failure.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(expectOk(await service.get(OWNER, acting('owner')))).toEqual(view());
  });
});
