import { expectOk } from '@kit/testing/result';
import { defaultChannelLayout, type NewChannelAuditEntry } from '@vp/domain';
import { OWNER_CHANNEL_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const draftAudit = (version: number) =>
  ({
    channelId: OWNER_CHANNEL_ID,
    actorUserId: OWNER_ID,
    action: 'page.draft_saved',
    targetType: 'page',
    targetId: OWNER_CHANNEL_ID,
    meta: { version },
  }) satisfies NewChannelAuditEntry;

const publishAudit = (version: number) =>
  ({
    channelId: OWNER_CHANNEL_ID,
    actorUserId: OWNER_ID,
    action: 'page.published',
    targetType: 'page',
    targetId: OWNER_CHANNEL_ID,
    meta: { version },
  }) satisfies NewChannelAuditEntry;

export function describeChannelLayoutContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelLayoutRepository contract', () => {
    let subject: RepositoriesSubject;
    const document = defaultChannelLayout();

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
    });

    const save = async (expectedVersion: number) =>
      expectOk(
        await subject.repositories.channelLayouts.saveDraft({
          channelId: OWNER_CHANNEL_ID,
          document,
          expectedVersion,
          userId: OWNER_ID,
          audit: draftAudit(expectedVersion + 1),
        })
      );

    it('saves the first draft at version 1, then each save under the version read', async () => {
      expect(await save(0)).toMatchObject({ type: 'saved', draft: { version: 1 } });
      expect(await save(1)).toMatchObject({ type: 'saved', draft: { version: 2 } });

      const draft = expectOk(await subject.repositories.channelLayouts.getDraft(OWNER_CHANNEL_ID));
      expect(draft).toMatchObject({ version: 2, updatedBy: OWNER_ID, document });
    });

    it.each([
      { scenario: 'a save under a version already replaced', first: 1, stale: 1 },
      { scenario: 'a second first save', first: 0, stale: 0 },
    ])('refuses $scenario and keeps the draft as it was', async ({ stale }) => {
      await save(0);
      await save(1);

      expect(await save(stale)).toEqual({ type: 'stale' });
      const draft = expectOk(await subject.repositories.channelLayouts.getDraft(OWNER_CHANNEL_ID));
      expect(draft?.version).toBe(2);
    });

    it('appends a revision per publish and answers the newest as the published layout', async () => {
      const { channelLayouts } = subject.repositories;
      expect(expectOk(await channelLayouts.getPublished(OWNER_CHANNEL_ID))).toBeNull();

      const publish = async (note: string, restoredFromVersion: number | null) =>
        expectOk(
          await channelLayouts.publish({
            channelId: OWNER_CHANNEL_ID,
            document,
            authorUserId: OWNER_ID,
            note,
            restoredFromVersion,
            audit: publishAudit,
          })
        );

      expect(await publish('first', null)).toMatchObject({ version: 1 });
      expect(await publish('again', 1)).toMatchObject({ version: 2, restoredFromVersion: 1 });
      expect(expectOk(await channelLayouts.getPublished(OWNER_CHANNEL_ID))).toMatchObject({
        version: 2,
        note: 'again',
        authorUserId: OWNER_ID,
      });
    });
  });
}
