import type {
  ChannelHandleHistoryRepositoryPort,
  ChannelRepositoryPort,
} from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const DAY_MS = 86_400_000;

export function describeChannelHandleHistoryRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('ChannelHandleHistoryRepository contract', () => {
    let subject: RepositoriesSubject;
    let history: ChannelHandleHistoryRepositoryPort;
    let channels: ChannelRepositoryPort;
    let channelId: string;

    const retire = async (from: string, to: string, at: Date) => {
      expectOk(await channels.update(channelId, { handle: from }));
      expectOk(await channels.update(channelId, { handle: to, handleChangedAt: at }));
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
      channels = subject.repositories.channels;
      history = subject.repositories.channelHandleHistory;
      channelId = expectOk(
        await channels.create({ userId: OWNER_ID, handle: 'first', displayName: 'Owner' })
      ).id;
    });

    it('knows no handle nobody gave up', async () => {
      expect(expectOk(await history.findByHandle('first'))).toBeNull();
    });

    it('finds a retired handle whatever its case', async () => {
      const at = new Date('2026-03-01T00:00:00.000Z');
      await retire('first', 'second', at);

      expect(expectOk(await history.findByHandle('FIRST'))).toEqual({
        handle: 'first',
        channelId,
        retiredAt: at,
      });
    });

    it('purges only the handles retired before the cutoff and counts them', async () => {
      const now = Date.now();
      await retire('first', 'second', new Date(now - 100 * DAY_MS));
      await retire('second', 'third', new Date(now - 10 * DAY_MS));

      expect(expectOk(await history.purgeOlderThan(new Date(now - 90 * DAY_MS)))).toBe(1);
      expect(expectOk(await history.findByHandle('first'))).toBeNull();
      expect(expectOk(await history.findByHandle('second'))).not.toBeNull();
      expect(expectOk(await history.purgeOlderThan(new Date(now - 90 * DAY_MS)))).toBe(0);
    });
  });
}
