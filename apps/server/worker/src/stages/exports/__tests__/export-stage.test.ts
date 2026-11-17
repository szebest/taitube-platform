import * as os from 'node:os';
import {
  InMemoryRepositories,
  InMemoryStorageClient,
  InMemoryWebhookDispatcher,
} from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { CommentExportRow, DataExportFormat, DataExportKind } from '@vp/domain';
import { ErrorCodes, databaseUnavailable } from '@vp/errors';
import type { ExportJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { type ExportProcessorDeps, createExportProcessor } from '../export-stage';

const OWNER_ID = uuidv7();
const FAN_ID = uuidv7();
const MANAGER_ID = uuidv7();
const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const logger = createLogger({ format: 'json', service: 'export-spec', level: 'silent' });

describe('worker/exports: export stage', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let dispatcher: InMemoryWebhookDispatcher;
  let channelId: string;
  let videoId: string;

  const processor = (overrides: Partial<ExportProcessorDeps> = {}) =>
    createExportProcessor({
      repositories,
      storage,
      webhookDispatcher: dispatcher,
      bucket: 'raw',
      tmpDir: os.tmpdir(),
      logger,
      now: () => NOW,
      ...overrides,
    });

  const jobOf = (exportId: string, attempts = 3): QueueJob<ExportJob> => ({
    id: `${exportId}--export`,
    name: 'export',
    data: { exportId },
    opts: { attempts },
    attemptsMade: 0,
  });

  async function requested(
    kind: DataExportKind = 'comments',
    format: DataExportFormat = 'csv',
    requestedBy = OWNER_ID
  ) {
    const id = uuidv7();
    expectOk(
      await repositories.dataExports.create(
        { id, channelId, requestedBy, kind, params: {}, format },
        {
          channelId,
          actorUserId: requestedBy,
          action: 'export.requested',
          targetType: 'export',
          targetId: id,
          meta: { kind, format },
        }
      )
    );
    return id;
  }

  const fileOf = async (id: string, format: DataExportFormat = 'csv') =>
    expectOk(await storage.getObject('raw', `exports/${channelId}/${id}.${format}`)).toString(
      'utf8'
    );

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    dispatcher = new InMemoryWebhookDispatcher();
    channelId = expectOk(
      await repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    ).id;
    expectOk(
      await repositories.channels.create({ userId: FAN_ID, handle: 'fan', displayName: 'Fan' })
    );
    videoId = expectOk(
      await repositories.videos.create({
        id: uuidv7(),
        ownerId: OWNER_ID,
        sourceKey: 'raw/v/source.mp4',
        title: 'Clip',
        visibility: 'public',
        status: 'READY',
      })
    ).id;
    expectOk(
      await repositories.webhooks.create({
        id: uuidv7(),
        ownerId: OWNER_ID,
        url: 'https://hooks.example.com/in',
        events: ['export.ready'],
        secret: 'secret',
        createdAt: new Date(NOW),
      })
    );
  });

  async function commented(content: string) {
    expectOk(
      await repositories.comments.create({
        id: uuidv7(),
        videoId,
        authorId: FAN_ID,
        parentId: null,
        content,
      })
    );
  }

  it('writes a comment that starts with a formula as text, and never an email or account id', async () => {
    await commented('=cmd|"/c calc"!A1');
    const id = await requested();

    expect(expectOk(await processor()(jobOf(id)))).toEqual({ exportId: id, rowCount: 1 });

    const file = await fileOf(id);
    const [header, row] = file.split('\r\n');
    expect(header).toBe(
      'commentId,videoId,videoTitle,parentId,authorHandle,authorDisplayName,text,createdAt,likes,hearted,pinned,moderationState,disclosure'
    );
    expect(row).toContain(`,fan,Fan,"'=cmd|""/c calc""!A1",`);
    expect(file).not.toContain(FAN_ID);
    expect(file).not.toMatch(/@video-pipeline|email/i);
  });

  it('writes one JSON array, marks the export ready for seven days and announces it', async () => {
    await commented('first');
    await commented('second');
    const id = await requested('comments', 'json');

    expectOk(await processor()(jobOf(id)));

    const rows: CommentExportRow[] = JSON.parse(await fileOf(id, 'json'));
    expect(rows.map(({ text }) => text)).toEqual(['first', 'second']);
    expect(expectOk(await repositories.dataExports.findById(id))).toMatchObject({
      status: 'ready',
      rowCount: 2,
      objectKey: `exports/${channelId}/${id}.json`,
      expiresAt: new Date('2026-03-08T12:00:00.000Z'),
    });
    expect(dispatcher.deliveries).toEqual([
      expect.objectContaining({
        event: 'export.ready',
        payload: expect.objectContaining({ exportId: id, channelId, rowCount: 2 }),
      }),
    ]);
  });

  describe('who hears export.ready', () => {
    const hookOf = (ownerId: string, url: string) =>
      repositories.webhooks.create({
        id: uuidv7(),
        ownerId,
        url,
        events: ['export.ready'],
        secret: 'secret',
        createdAt: new Date(NOW),
      });
    const urls = () => dispatcher.deliveries.map(({ webhook }) => webhook.url).sort();

    it('announces to the team member who asked as well as to the owner', async () => {
      expectOk(await hookOf(MANAGER_ID, 'https://hooks.example.com/manager'));
      const id = await requested('comments', 'csv', MANAGER_ID);

      expectOk(await processor()(jobOf(id)));

      expect(urls()).toEqual(['https://hooks.example.com/in', 'https://hooks.example.com/manager']);
    });

    it('announces once to an owner who asked', async () => {
      const id = await requested();

      expectOk(await processor()(jobOf(id)));

      expect(urls()).toEqual(['https://hooks.example.com/in']);
    });
  });

  it('reads 100,000 rows a page at a time and writes every one', async () => {
    const pageSize = 1000;
    const total = 100_000;
    const asked: number[] = [];
    vi.spyOn(repositories.exportRows, 'comments').mockImplementation(
      async (_scope, after, limit) => {
        asked.push(limit);
        const offset = after === null ? 0 : Number(after);
        const rows = Array.from({ length: Math.min(limit, total - offset) }, (_, n) => ({
          commentId: `c${offset + n}`,
          videoId,
          videoTitle: 'Clip',
          parentId: null,
          authorHandle: 'fan',
          authorDisplayName: 'Fan',
          text: `comment ${offset + n}`,
          createdAt: new Date(NOW).toISOString(),
          likes: 0,
          hearted: false,
          pinned: false,
          moderationState: 'published' as const,
          disclosure: null,
        }));
        const end = offset + rows.length;
        return ok({ rows, next: end < total ? String(end) : null });
      }
    );
    const id = await requested();

    const limits = { maxRows: 1_000_000, maxBytes: 500 * 1024 * 1024, pageSize };
    expect(expectOk(await processor({ limits })(jobOf(id))).rowCount).toBe(total);

    expect(new Set(asked)).toEqual(new Set([pageSize]));
    expect(asked).toHaveLength(total / pageSize);
    expect((await fileOf(id)).split('\r\n').filter(Boolean)).toHaveLength(total + 1);
  });

  it.each([
    { limit: 'rows', limits: { maxRows: 1, maxBytes: 1_000_000, pageSize: 10 } },
    { limit: 'bytes', limits: { maxRows: 100, maxBytes: 50, pageSize: 10 } },
  ])(
    'fails an export over its $limit for good, uploads nothing and tells the requester',
    async ({ limits }) => {
      await commented('one comment that is long enough');
      await commented('two');
      const id = await requested();

      const failed = expectErr(await processor({ limits })(jobOf(id)));

      expect(failed.code).toBe(ErrorCodes.EXPORT_TOO_LARGE);
      expect(expectOk(await repositories.dataExports.findById(id))).toMatchObject({
        status: 'failed',
        failure: expect.stringContaining('narrow the range'),
      });
      expect(
        expectOk(await storage.listObjects({ bucket: 'raw', prefix: 'exports/' })).keys
      ).toEqual([]);
      expect(dispatcher.deliveries).toEqual([]);
    }
  );

  it('does nothing for an export already written, so a duplicated job writes one file', async () => {
    await commented('once');
    const id = await requested();
    const run = processor();

    expectOk(await run(jobOf(id)));
    expect(expectOk(await run(jobOf(id)))).toEqual({ exportId: id, rowCount: null });

    expect(dispatcher.deliveries).toHaveLength(1);
  });

  it('throws the file away when the export was deleted while it was written', async () => {
    const id = await requested();
    vi.spyOn(repositories.dataExports, 'finish').mockResolvedValue(ok(null));

    expect(expectOk(await processor()(jobOf(id)))).toEqual({ exportId: id, rowCount: null });

    expect(expectOk(await storage.listObjects({ bucket: 'raw', prefix: 'exports/' })).keys).toEqual(
      []
    );
  });

  it.each([
    { attempt: 'an attempt the queue retries', attempts: 3, status: 'running' },
    { attempt: 'the last attempt', attempts: 1, status: 'failed' },
  ])('leaves a failing row source to $attempt', async ({ attempts, status }) => {
    vi.spyOn(repositories.exportRows, 'comments').mockResolvedValue(
      err(databaseUnavailable.during('exportComments')(new Error('down')))
    );
    const id = await requested();

    expect(expectErr(await processor()(jobOf(id, attempts))).code).toBe(
      ErrorCodes.DATABASE_UNAVAILABLE
    );
    expect(expectOk(await repositories.dataExports.findById(id))?.status).toBe(status);
  });
});
