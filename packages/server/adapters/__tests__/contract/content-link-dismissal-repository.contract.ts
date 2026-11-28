import { expectOk } from '@kit/testing/result';
import { OTHER_OWNER_CHANNEL_ID, OWNER_CHANNEL_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeContentLinkDismissalRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('ContentLinkDismissalRepository contract', () => {
    let subject: RepositoriesSubject;

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

    it('remembers a dismissal once per channel, however often it is repeated', async () => {
      const { contentLinkDismissals: dismissals } = subject.repositories;

      expectOk(await dismissals.dismiss(OWNER_CHANNEL_ID, 'video:a>video:b>related', OWNER_ID));
      expectOk(await dismissals.dismiss(OWNER_CHANNEL_ID, 'video:a>video:b>related', OWNER_ID));
      expectOk(await dismissals.dismiss(OWNER_CHANNEL_ID, 'video:a>video:c>recap', OWNER_ID));

      expect(expectOk(await dismissals.dismissedKeys(OWNER_CHANNEL_ID))).toEqual(
        new Set(['video:a>video:b>related', 'video:a>video:c>recap'])
      );
      expect(expectOk(await dismissals.dismissedKeys(OTHER_OWNER_CHANNEL_ID))).toEqual(new Set());
    });
  });
}
