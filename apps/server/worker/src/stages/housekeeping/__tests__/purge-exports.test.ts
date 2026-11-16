import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { MS_PER_DAY } from '@vp/domain/time';
import { storageUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runPurgeExports } from '../purge-exports';

const OWNER_ID = '00000000-0000-7000-8000-00000000a001';
const READY_AT = Date.parse('2026-03-01T12:00:00.000Z');

describe('housekeeping: purge-exports', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let channelId: string;

  const purge = (days: number) =>
    runPurgeExports({
      repositories,
      storage,
      rawBucket: 'raw',
      scanLimit: 100,
      now: () => READY_AT + days * MS_PER_DAY,
    });

  async function requested() {
    const id = uuidv7();
    expectOk(
      await repositories.dataExports.create(
        { id, channelId, requestedBy: OWNER_ID, kind: 'videos', params: {}, format: 'csv' },
        {
          channelId,
          actorUserId: OWNER_ID,
          action: 'export.requested',
          targetType: 'export',
          targetId: id,
          meta: { kind: 'videos', format: 'csv' },
        }
      )
    );
    expectOk(await repositories.dataExports.start(id));
    return id;
  }

  async function ready() {
    const id = await requested();
    const objectKey = `exports/${channelId}/${id}.csv`;
    expectOk(
      await repositories.dataExports.finish(id, {
        objectKey,
        rowCount: 1,
        expiresAt: new Date(READY_AT + 7 * MS_PER_DAY),
      })
    );
    expectOk(
      await storage.uploadObject({
        bucket: 'raw',
        key: objectKey,
        body: 'x',
        contentType: 'text/csv',
      })
    );
    return id;
  }

  const keys = async () =>
    expectOk(await storage.listObjects({ bucket: 'raw', prefix: 'exports/' })).keys;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    channelId = expectOk(
      await repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    ).id;
  });

  it.each([
    { scenario: 'within its seven days', days: 6, purgedCount: 0, status: 'ready' },
    { scenario: 'past its seven days', days: 7, purgedCount: 1, status: 'expired' },
  ])('purges a file $scenario: $purgedCount', async ({ days, purgedCount, status }) => {
    const id = await ready();

    expect(expectOk(await purge(days))).toEqual({ purgedCount, abandonedCount: 0 });

    expect(await keys()).toHaveLength(1 - purgedCount);
    expect(expectOk(await repositories.dataExports.findById(id))?.status).toBe(status);
  });

  it('keeps an export whose file could not be deleted for the next run', async () => {
    const id = await ready();
    vi.spyOn(storage, 'deleteObject').mockResolvedValue(
      err(storageUnavailable.during('deleteObject')(new Error('down')))
    );

    expectErr(await purge(8));

    expect(expectOk(await repositories.dataExports.findById(id))?.status).toBe('ready');
    vi.restoreAllMocks();
    expect(expectOk(await purge(8))).toEqual({ purgedCount: 1, abandonedCount: 0 });
  });

  it('fails an export a dead job left running a day on, so the channel can ask again', async () => {
    const id = await requested();

    const purged = expectOk(
      await runPurgeExports({
        repositories,
        storage,
        rawBucket: 'raw',
        scanLimit: 100,
        now: () => Date.now() + MS_PER_DAY + 1000,
      })
    );

    expect(purged).toEqual({ purgedCount: 0, abandonedCount: 1 });
    expect(expectOk(await repositories.dataExports.findById(id))).toMatchObject({
      status: 'failed',
      failure: 'The export did not finish; ask for it again',
    });
  });
});
