import type { ChannelAuditRepositoryPort } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { auditOf, memberAudit, seedTeam } from './channel-team-fixtures';
import { OTHER_OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const MINUTE_MS = 60_000;

export function describeChannelAuditRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelAuditRepository contract', () => {
    let subject: RepositoriesSubject;
    let audit: ChannelAuditRepositoryPort;
    let channel: Channel;

    const listAll = async (query: { actorUserId?: string; action?: 'member.left' } = {}) =>
      expectOk(await audit.list(channel.id, { cursor: null, limit: 50, ...query }));

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
      audit = subject.repositories.channelAudit;
    });

    it('appends a row with an id and a time, and reads it back as written', async () => {
      const entry = memberAudit(channel, 'member.left');

      const written = expectOk(await audit.append(entry));

      expect(written).toMatchObject(entry);
      expect(await listAll()).toEqual([written]);
    });

    it('lists newest first, a page at a time, and filters by actor and action', async () => {
      const first = expectOk(await audit.append(auditOf(channel, 'invite.created', 1)));
      const second = expectOk(
        await audit.append(memberAudit(channel, 'member.left', OTHER_OWNER_ID))
      );

      expect((await listAll()).map((row) => row.id)).toEqual([second.id, first.id]);
      expect(
        expectOk(
          await audit.list(channel.id, {
            cursor: { createdAt: second.createdAt, id: second.id },
            limit: 50,
          })
        ).map((row) => row.id)
      ).toEqual([first.id]);
      expect((await listAll({ actorUserId: OTHER_OWNER_ID })).map((row) => row.id)).toEqual([
        second.id,
      ]);
      expect((await listAll({ action: 'member.left' })).map((row) => row.id)).toEqual([second.id]);
    });

    it('purges only what was written before the cutoff', async () => {
      expectOk(await audit.append(memberAudit(channel, 'member.left')));

      expect(expectOk(await audit.purgeOlderThan(new Date(Date.now() - MINUTE_MS)))).toBe(0);
      expect(expectOk(await audit.purgeOlderThan(new Date(Date.now() + MINUTE_MS)))).toBe(1);
      expect(await listAll()).toEqual([]);
    });
  });
}
