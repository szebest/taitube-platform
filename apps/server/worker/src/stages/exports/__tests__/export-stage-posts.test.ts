import * as os from 'node:os';
import { createLogger } from '@kit/logger';
import { expectOk } from '@kit/testing/result';
import {
  InMemoryRepositories,
  InMemoryStorageClient,
  InMemoryWebhookDispatcher,
} from '@vp/adapters/in-memory';
import { uuidv7 } from 'uuidv7';
import { createExportProcessor } from '../export-stage';

const OWNER_ID = uuidv7();
const logger = createLogger({ format: 'json', service: 'export-posts-spec', level: 'silent' });

describe('worker/exports: export stage, posts', () => {
  it('writes each post of the channel with its payload as one JSON cell', async () => {
    const repositories = new InMemoryRepositories();
    const storage = new InMemoryStorageClient();
    expectOk(await repositories.users.upsert({ id: OWNER_ID, email: 'owner@example.com' }));
    const { id: channelId } = expectOk(
      await repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    const postId = uuidv7();
    expectOk(
      await repositories.channelPosts.publish(
        {
          id: postId,
          channelId,
          authorUserId: OWNER_ID,
          payload: { kind: 'text', text: 'Dinner, at nine' },
          commentsEnabled: true,
        },
        {
          channelId,
          actorUserId: OWNER_ID,
          action: 'post.published',
          targetType: 'post',
          targetId: postId,
          meta: { kind: 'text' },
        }
      )
    );
    const exportId = uuidv7();
    expectOk(
      await repositories.dataExports.create(
        {
          id: exportId,
          channelId,
          requestedBy: OWNER_ID,
          kind: 'posts',
          params: {},
          format: 'csv',
        },
        {
          channelId,
          actorUserId: OWNER_ID,
          action: 'export.requested',
          targetType: 'export',
          targetId: exportId,
          meta: { kind: 'posts', format: 'csv' },
        }
      )
    );
    const process = createExportProcessor({
      repositories,
      storage,
      webhookDispatcher: new InMemoryWebhookDispatcher(),
      bucket: 'raw',
      tmpDir: os.tmpdir(),
      logger,
      now: () => Date.parse('2026-03-01T12:00:00.000Z'),
    });

    const result = await process({
      id: `${exportId}--export`,
      name: 'export',
      data: { exportId },
      opts: { attempts: 3 },
      attemptsMade: 0,
    });

    expect(expectOk(result)).toEqual({ exportId, rowCount: 1 });
    const file = expectOk(await storage.getObject('raw', `exports/${channelId}/${exportId}.csv`));
    const [header, row] = file.toString('utf8').split('\r\n');
    expect(header).toBe(
      'postId,kind,status,payload,commentsEnabled,likeCount,commentsCount,publishedAt,createdAt,editedAt'
    );
    expect(row).toContain(
      `${postId},text,published,"{""kind"":""text"",""text"":""Dinner, at nine""}",true,0,0,`
    );
  });
});
