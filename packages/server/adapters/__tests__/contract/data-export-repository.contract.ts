import type { DataExportRepositoryPort } from '@vp/core/repositories';
import type { Channel, NewChannelAuditEntry, NewDataExport } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { seedTeam } from './channel-team-fixtures';
import { OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const exportId = (n: number) => `00000000-0000-7000-8000-00000000e9${String(n).padStart(2, '0')}`;

const HOUR_AGO = () => new Date(Date.now() - 3_600_000);
const FINISHED = {
  objectKey: 'exports/c/e',
  rowCount: 3,
  expiresAt: new Date('2026-03-08T12:00:00.000Z'),
};

function request(
  channel: Channel,
  n: number,
  kind: NewDataExport['kind'] = 'comments'
): NewDataExport {
  return {
    id: exportId(n),
    channelId: channel.id,
    requestedBy: OWNER_ID,
    kind,
    params: { from: '2026-01-01' },
    format: 'csv',
  };
}

function audit(
  channel: Channel,
  n: number,
  action: 'export.requested' | 'export.deleted'
): NewChannelAuditEntry {
  return {
    channelId: channel.id,
    actorUserId: OWNER_ID,
    action,
    targetType: 'export',
    targetId: exportId(n),
    meta: { kind: 'comments', format: 'csv' },
  };
}

export function describeDataExportRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('DataExportRepository contract', () => {
    let subject: RepositoriesSubject;
    let exports: DataExportRepositoryPort;
    let channel: Channel;

    const requested = async (n: number, kind?: NewDataExport['kind']) =>
      expectOk(
        await exports.create(request(channel, n, kind), audit(channel, n, 'export.requested'))
      );

    const settled = async (n: number, kind?: NewDataExport['kind']) => {
      await requested(n, kind);
      expectOk(await exports.start(exportId(n)));
      expectOk(await exports.finish(exportId(n), FINISHED));
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
      exports = subject.repositories.dataExports;
    });

    it('queues a request with its audit entry, and refuses a second while it is unsettled', async () => {
      const first = await requested(1);
      const second = await requested(2);

      expect(first).toMatchObject({
        type: 'created',
        dataExport: { id: exportId(1), status: 'queued', params: { from: '2026-01-01' } },
      });
      expect(second).toEqual({ type: 'already-running' });
      const entries = expectOk(
        await subject.repositories.channelAudit.list(channel.id, { cursor: null, limit: 10 })
      );
      expect(entries.map(({ action, targetId }) => [action, targetId])).toEqual([
        ['export.requested', exportId(1)],
      ]);
    });

    it('counts what is unsettled and what was asked for since a time', async () => {
      await settled(1);
      await requested(2);

      expect(expectOk(await exports.usage(channel.id, HOUR_AGO()))).toEqual({
        running: true,
        today: 2,
      });
      expect(expectOk(await exports.usage(channel.id, new Date(Date.now() + 60_000)))).toEqual({
        running: true,
        today: 0,
      });
    });

    it('runs one through its lifecycle, a retried start included, and refuses a late move', async () => {
      await requested(1);

      expect(expectOk(await exports.start(exportId(1)))?.status).toBe('running');
      expect(expectOk(await exports.start(exportId(1)))?.status).toBe('running');
      expect(expectOk(await exports.finish(exportId(1), FINISHED))).toMatchObject({
        status: 'ready',
        ...FINISHED,
      });
      expect(expectOk(await exports.finish(exportId(1), FINISHED))).toBeNull();
      expect(expectOk(await exports.fail(exportId(1), 'late'))).toBeNull();
      expect(expectOk(await exports.start(exportId(1)))).toBeNull();
    });

    it('tells the requester when the file is ready, and why one failed', async () => {
      await settled(1);
      await requested(2);
      expectOk(await exports.fail(exportId(2), 'too large'));

      const told = expectOk(await subject.repositories.userEvents.listFrom(OWNER_ID, 1, 10));
      expect(told.map(({ type, payload }) => ({ type, payload }))).toEqual([
        {
          type: 'export.ready',
          payload: {
            exportId: exportId(1),
            channelId: channel.id,
            kind: 'comments',
            format: 'csv',
            rowCount: 3,
            expiresAt: FINISHED.expiresAt.toISOString(),
          },
        },
        {
          type: 'export.failed',
          payload: {
            exportId: exportId(2),
            channelId: channel.id,
            kind: 'comments',
            reason: 'too large',
          },
        },
      ]);
    });

    it('lists the kinds asked for, newest first, a page at a time', async () => {
      await settled(1, 'comments');
      await settled(2, 'channel_analytics');
      await settled(3, 'video_analytics');

      const first = expectOk(
        await exports.list(channel.id, {
          kinds: ['channel_analytics', 'video_analytics'],
          cursor: null,
          limit: 1,
        })
      );
      const last = first[0];
      if (!last) throw new Error('the first page is empty');
      const second = expectOk(
        await exports.list(channel.id, {
          kinds: ['channel_analytics', 'video_analytics'],
          cursor: { createdAt: last.createdAt, id: last.id },
          limit: 1,
        })
      );

      expect(first.map(({ id }) => id)).toEqual([exportId(3), exportId(2)]);
      expect(second.map(({ id }) => id)).toEqual([exportId(2)]);
    });

    it('removes an export with its audit entry, once', async () => {
      await settled(1);

      expect(
        expectOk(await exports.remove(exportId(1), audit(channel, 1, 'export.deleted')))?.id
      ).toBe(exportId(1));
      expect(
        expectOk(await exports.remove(exportId(1), audit(channel, 1, 'export.deleted')))
      ).toBeNull();
      expect(expectOk(await exports.findById(exportId(1)))).toBeNull();
    });

    it('finds the unsettled exports asked for before a time, and not the settled ones', async () => {
      await settled(1);
      await requested(2);
      const later = new Date(Date.now() + 60_000);

      expect(expectOk(await exports.listStale(HOUR_AGO(), 10))).toEqual([]);
      expect(expectOk(await exports.listStale(later, 10)).map(({ id }) => id)).toEqual([
        exportId(2),
      ]);
    });

    it('finds the files past their expiry and expires them, once', async () => {
      await settled(1);

      expect(expectOk(await exports.listExpired(new Date('2026-03-08T11:59:59.000Z'), 10))).toEqual(
        []
      );
      const due = expectOk(await exports.listExpired(FINISHED.expiresAt, 10));
      expect(due.map(({ id }) => id)).toEqual([exportId(1)]);
      expect(expectOk(await exports.expire([exportId(1)]))).toBe(1);
      expect(expectOk(await exports.expire([exportId(1)]))).toBe(0);
      expect(expectOk(await exports.findById(exportId(1)))).toMatchObject({
        status: 'expired',
        objectKey: null,
      });
    });
  });
}
