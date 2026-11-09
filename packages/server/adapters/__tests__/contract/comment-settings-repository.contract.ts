import type { Repositories } from '@vp/core/repositories';
import {
  type Channel,
  type CommentSettings,
  DEFAULT_COMMENT_SETTINGS,
  type NewChannelAuditEntry,
} from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { seedTeam } from './channel-team-fixtures';
import { OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const STRICT: CommentSettings = {
  reviewMode: 'links',
  blockedWords: ['spoiler', 'cafe'],
  linkAllowlist: ['example.com'],
  slowModeSeconds: 30,
  subscribersOnly: true,
  minAccountAgeDays: 7,
  disclosure: { ...DEFAULT_COMMENT_SETTINGS.disclosure, hide: 'visible' },
};

const auditOf = (channel: Channel): NewChannelAuditEntry => ({
  channelId: channel.id,
  actorUserId: OWNER_ID,
  action: 'settings.comments.updated',
  targetType: 'settings',
  targetId: channel.id,
  meta: { fields: ['reviewMode'] },
});

export function describeCommentSettingsRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('CommentSettingsRepository contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;
    let channel: Channel;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      repositories = subject.repositories;
      await seedOwners(repositories);
      channel = await seedTeam(repositories);
    });

    it('answers the defaults for a channel that never saved', async () => {
      expect(expectOk(await repositories.commentSettings.get(channel.id))).toEqual(
        DEFAULT_COMMENT_SETTINGS
      );
    });

    it.each([
      { name: 'the first save', saves: [STRICT], expected: STRICT },
      {
        name: 'a second save, which replaces the whole document',
        saves: [STRICT, DEFAULT_COMMENT_SETTINGS],
        expected: DEFAULT_COMMENT_SETTINGS,
      },
    ])('reads back $name', async ({ saves, expected }) => {
      for (const settings of saves) {
        expect(
          expectOk(await repositories.commentSettings.save(channel.id, settings, auditOf(channel)))
        ).toEqual(settings);
      }

      expect(expectOk(await repositories.commentSettings.get(channel.id))).toEqual(expected);
    });

    it('audits the save on the channel, as the member who made it', async () => {
      expectOk(await repositories.commentSettings.save(channel.id, STRICT, auditOf(channel)));

      const log = expectOk(
        await repositories.channelAudit.list(channel.id, { cursor: null, limit: 10 })
      );
      expect(log).toMatchObject([
        { actorUserId: OWNER_ID, action: 'settings.comments.updated', targetId: channel.id },
      ]);
    });

    it('keeps one channel settings apart from another', async () => {
      const other = expectOk(
        await repositories.channels.create({
          userId: '00000000-0000-7000-8000-000000000102',
          handle: 'other',
          displayName: 'Other',
        })
      );
      expectOk(await repositories.commentSettings.save(channel.id, STRICT, auditOf(channel)));

      expect(expectOk(await repositories.commentSettings.get(other.id))).toEqual(
        DEFAULT_COMMENT_SETTINGS
      );
    });
  });
}
