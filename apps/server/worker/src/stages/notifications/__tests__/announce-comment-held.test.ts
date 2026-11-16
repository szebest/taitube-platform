import { InMemoryRepositories, InMemoryWebhookDispatcher } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { WebhookEvent } from '@vp/domain';
import type { AnnounceCommentHeldJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createAnnounceCommentHeldProcessor } from '../announce-comment-held';
import {
  CHANNEL_ID,
  CREATOR_ID,
  logger,
  seedCreator,
  seedVideo,
  userId,
  videoId,
} from './notification-harness';

const VIDEO_ID = videoId(1);
const COMMENT_ID = '00000000-0000-7000-8000-0000000000d1';
const MODERATOR_ID = userId(7);

function jobOf(data: Partial<AnnounceCommentHeldJob> = {}): QueueJob<AnnounceCommentHeldJob> {
  return {
    id: 'hold-1--announce-comment-held',
    name: 'announce-comment-held',
    data: {
      holdId: '00000000-0000-7000-8000-0000000000d2',
      commentId: COMMENT_ID,
      videoId: VIDEO_ID,
      recipients: [CREATOR_ID, MODERATOR_ID],
      ...data,
    },
  } as QueueJob<AnnounceCommentHeldJob>;
}

describe('worker: announce a held comment to webhooks', () => {
  let repositories: InMemoryRepositories;
  let dispatcher: InMemoryWebhookDispatcher;
  let process: ReturnType<typeof createAnnounceCommentHeldProcessor>;

  const webhookOf = async (n: number, ownerId: string, events: WebhookEvent[]) =>
    expectOk(
      await repositories.webhooks.create({
        id: `00000000-0000-7000-8000-0000000000e${n}`,
        ownerId,
        url: `https://hooks.example.com/${n}`,
        events,
        secret: 'secret',
        createdAt: new Date(0),
      })
    );

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    dispatcher = new InMemoryWebhookDispatcher();
    process = createAnnounceCommentHeldProcessor({
      repositories,
      webhookDispatcher: dispatcher,
      logger,
    });
    await seedCreator(repositories);
    await seedVideo(repositories, VIDEO_ID);
  });

  it('tells each recipient subscribed to comment.held the ids and the channel, never the text', async () => {
    await webhookOf(1, CREATOR_ID, ['comment.held']);
    await webhookOf(2, MODERATOR_ID, ['comment.held', 'video.ready']);
    await webhookOf(3, MODERATOR_ID, ['video.ready']);

    expect(expectOk(await process(jobOf()))).toEqual({
      commentId: COMMENT_ID,
      channelId: CHANNEL_ID,
    });
    expect(
      dispatcher.deliveries.map(({ webhook, event, payload }) => [webhook.id, event, payload])
    ).toEqual([
      [
        '00000000-0000-7000-8000-0000000000e1',
        'comment.held',
        { commentId: COMMENT_ID, videoId: VIDEO_ID, channelId: CHANNEL_ID },
      ],
      [
        '00000000-0000-7000-8000-0000000000e2',
        'comment.held',
        { commentId: COMMENT_ID, videoId: VIDEO_ID, channelId: CHANNEL_ID },
      ],
    ]);
  });

  it('tells nobody when the video is gone', async () => {
    await webhookOf(1, CREATOR_ID, ['comment.held']);

    expect(expectOk(await process(jobOf({ videoId: videoId(9) })))).toEqual({
      commentId: COMMENT_ID,
      channelId: null,
    });
    expect(dispatcher.deliveries).toEqual([]);
  });
});
