import type { Repositories } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { seedTeam } from './channel-team-fixtures';
import { OTHER_OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const LIMIT = 3;

export function describeSavedReplyRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('SavedReplyRepository contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;
    let channel: Channel;

    const create = async (title: string, channelId = channel.id) =>
      expectOk(
        await repositories.savedReplies.create(channelId, { title, body: `${title} body` }, LIMIT)
      );
    const titles = async (channelId = channel.id) =>
      expectOk(await repositories.savedReplies.list(channelId)).map((reply) => reply.title);

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

    it('lists nothing for a channel without replies', async () => {
      expect(await titles()).toEqual([]);
    });

    it('appends each reply after the last one', async () => {
      await create('one');
      await create('two');

      expect(expectOk(await repositories.savedReplies.list(channel.id))).toMatchObject([
        { title: 'one', position: 0 },
        { title: 'two', position: 1 },
      ]);
    });

    it('refuses a reply past the limit and keeps what it holds', async () => {
      await create('one');
      await create('two');
      await create('three');

      expect(await create('four')).toBeNull();
      expect(await titles()).toEqual(['one', 'two', 'three']);
    });

    it('orders by position after an update', async () => {
      const first = await create('one');
      await create('two');

      await repositories.savedReplies.update(channel.id, first?.id ?? '', { position: 5 });

      expect(await titles()).toEqual(['two', 'one']);
    });

    it('updates only the given fields and returns the reply', async () => {
      const reply = await create('one');

      const updated = expectOk(
        await repositories.savedReplies.update(channel.id, reply?.id ?? '', { body: 'changed' })
      );

      expect(updated).toMatchObject({ title: 'one', body: 'changed', position: 0 });
    });

    it('removes a reply once, and says so when it was already gone', async () => {
      const reply = await create('one');
      const remove = async () =>
        expectOk(await repositories.savedReplies.remove(channel.id, reply?.id ?? ''));

      expect([await remove(), await remove()]).toEqual([true, false]);
      expect(await titles()).toEqual([]);
    });

    it('keeps replies per channel, and touches another channel reply never', async () => {
      const other = expectOk(
        await repositories.channels.create({
          userId: OTHER_OWNER_ID,
          handle: 'other',
          displayName: 'Other',
        })
      );
      const mine = await create('mine');

      const update = expectOk(
        await repositories.savedReplies.update(other.id, mine?.id ?? '', { title: 'taken' })
      );
      const remove = expectOk(await repositories.savedReplies.remove(other.id, mine?.id ?? ''));

      expect([update, remove]).toEqual([null, false]);
      expect(await titles(other.id)).toEqual([]);
      expect(await titles()).toEqual(['mine']);
    });
  });
}
