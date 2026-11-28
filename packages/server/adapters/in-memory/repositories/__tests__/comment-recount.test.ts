import { ok } from '@kit/result';
import type { ChannelPost, Video } from '@vp/domain';
import type { PublicScopeContext } from '../comment-public-scope';
import { recountAuthored } from '../comment-recount';
import type { CommentTargetStores } from '../comment-targets';
import type { StoredComment } from '../comment-visibility';
import { aStoredComment } from './stored-comment';

const video = (id: string, commentsCount: number) => ({ id, commentsCount });
const on = (type: 'video' | 'post', id: string) => ({ type, id });

describe('adapters/in-memory: recountAuthored', () => {
  it('counts again only the targets of the channel the user commented on, from what an anonymous reader sees', async () => {
    const rows = [
      aStoredComment({ id: 'c1', target: on('video', 'v1'), authorId: 'user' }),
      aStoredComment({ id: 'c2', target: on('video', 'v1'), authorId: 'other' }),
      aStoredComment({
        id: 'c3',
        target: on('video', 'v1'),
        authorId: 'other',
        moderationState: 'held',
      }),
      aStoredComment({ id: 'c4', target: on('video', 'v2'), authorId: 'other' }),
      aStoredComment({ id: 'c5', target: on('post', 'p1'), authorId: 'user' }),
      aStoredComment({ id: 'c6', target: on('post', 'p1'), authorId: 'other' }),
      aStoredComment({
        id: 'c7',
        target: on('video', 'v3'),
        channelId: 'elsewhere',
        authorId: 'user',
      }),
    ];
    const comments = new Map<string, StoredComment>(rows.map((row) => [row.id, row]));
    const videos = new Map(
      [video('v1', 3), video('v2', 9), video('v3', 5)].map((row) => [row.id, row])
    );
    const post = { id: 'p1', commentsCount: 7 };
    const stores: CommentTargetStores = {
      videosRepo: { findById: async (id) => ok((videos.get(id) ?? null) as Video | null) },
      postsRepo: { posts: new Map([[post.id, post as ChannelPost]]) },
      threadsRepo: { threads: new Map() },
      channelsRepo: { findById: async () => ok(null) },
    };
    const scope: PublicScopeContext = {
      comments,
      shadowed: new Map([['channel-1', new Set(['user'])]]),
    };

    const touched = await recountAuthored(stores, comments, 'channel-1', 'user', scope);

    expect(touched).toEqual([on('post', 'p1'), on('video', 'v1')]);
    expect([...videos.values(), post]).toEqual([
      video('v1', 1),
      video('v2', 9),
      video('v3', 5),
      { id: 'p1', commentsCount: 1 },
    ]);
  });
});
