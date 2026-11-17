import { Paginator } from '@kit/pagination';
import { err, ok } from '@kit/result';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { ActingChannel } from '@vp/domain';
import { ErrorCodes, storageUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelExportService } from '../channel-export-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000018c1', role: 'USER' };
const NOW = Date.parse('2026-03-01T12:00:00.000Z');

async function setup() {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const { id: channelId } = expectOk(
    await repositories.channels.create({ userId: OWNER.id, handle: 'owner', displayName: 'Owner' })
  );
  const acting: ActingChannel = { channelId, ownerId: OWNER.id, role: 'owner' };
  const service = new ChannelExportService({
    exports: repositories.dataExports,
    storage,
    bucket: 'raw',
    downloadTtlSeconds: 300,
    paginator: new Paginator(),
    now: () => NOW,
  });
  const request = async () =>
    expectOk(await service.create(OWNER, acting, { kind: 'videos', format: 'json', params: {} }));
  const ready = async () => {
    const { id } = await request();
    const objectKey = `exports/${channelId}/${id}.json`;
    expectOk(await repositories.dataExports.start(id));
    expectOk(
      await repositories.dataExports.finish(id, {
        objectKey,
        rowCount: 2,
        expiresAt: new Date(NOW + 86_400_000),
      })
    );
    expectOk(
      await storage.uploadObject({ bucket: 'raw', key: objectKey, body: '[]', contentType: 'x' })
    );
    return { id, objectKey };
  };
  return { repositories, storage, service, acting, request, ready };
}

describe('apps/server/api/services: ChannelExportService', () => {
  it('answers a request that lost the race for the channel slot as already running', async () => {
    const { repositories, service, acting } = await setup();
    vi.spyOn(repositories.dataExports, 'create').mockResolvedValue(ok({ type: 'already-running' }));

    const created = await service.create(OWNER, acting, {
      kind: 'videos',
      format: 'csv',
      params: {},
    });

    expect(expectErr(created).code).toBe(ErrorCodes.EXPORT_IN_PROGRESS);
  });

  it('hands out the export without its storage key, and a presigned GET once it is ready', async () => {
    const { service, acting, ready } = await setup();
    const { id, objectKey } = await ready();

    const read = expectOk(await service.get(OWNER, acting, id));

    expect(read).not.toHaveProperty('objectKey');
    expect(read).toMatchObject({ id, status: 'ready', rowCount: 2 });
    expect(read.downloadUrl).toContain(objectKey);
  });

  it('keeps the export when its file could not be deleted, so the caller can delete again', async () => {
    const { repositories, storage, service, acting, ready } = await setup();
    const { id } = await ready();
    vi.spyOn(storage, 'deleteObject').mockResolvedValue(
      err(storageUnavailable.during('deleteObject')(new Error('down')))
    );

    expect(expectErr(await service.remove(OWNER, acting, id)).code).toBe(
      ErrorCodes.STORAGE_UNAVAILABLE
    );
    expect(expectOk(await repositories.dataExports.findById(id))).not.toBeNull();
  });

  it('counts the day the cap applies to back from now', async () => {
    const { repositories, service, acting } = await setup();
    const usage = vi.spyOn(repositories.dataExports, 'usage');

    await service.create(OWNER, acting, { kind: 'videos', format: 'csv', params: {} });

    expect(usage).toHaveBeenCalledWith(acting.channelId, new Date(NOW - 86_400_000));
  });
});
