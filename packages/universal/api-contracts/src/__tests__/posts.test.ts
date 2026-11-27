import { ErrorCodes } from '@vp/errors';
import {
  createPost,
  createPostComment,
  deletePost,
  getCommunityFeed,
  getPost,
  likePost,
  listChannelPosts,
  listPostComments,
  unlikePost,
  updatePost,
} from '../posts';

const UPLOAD = '00000000-0000-7000-8000-0000000012a1';
const VIDEO = '00000000-0000-7000-8000-0000000012a2';

describe('packages/api-contracts: posts', () => {
  it.each([
    { endpoint: listChannelPosts, method: 'GET', path: '/v1/channels/:idOrHandle/posts' },
    { endpoint: getPost, method: 'GET', path: '/v1/posts/:id' },
    { endpoint: createPost, method: 'POST', path: '/v1/me/channel/posts' },
    { endpoint: updatePost, method: 'PATCH', path: '/v1/me/channel/posts/:id' },
    { endpoint: deletePost, method: 'DELETE', path: '/v1/me/channel/posts/:id' },
    { endpoint: likePost, method: 'PUT', path: '/v1/posts/:id/reactions' },
    { endpoint: unlikePost, method: 'DELETE', path: '/v1/posts/:id/reactions' },
    { endpoint: getCommunityFeed, method: 'GET', path: '/v1/feed/community' },
    { endpoint: listPostComments, method: 'GET', path: '/v1/posts/:id/comments' },
    { endpoint: createPostComment, method: 'POST', path: '/v1/posts/:id/comments' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it.each([createPost, updatePost, deletePost])(
    'lets a token with posts:write act on the channel: $method $path',
    (endpoint) => {
      expect(endpoint).toMatchObject({ scope: 'posts:write', channelScoped: true });
    }
  );

  it('keeps the reads open to anonymous viewers and the writes closed', () => {
    expect([listChannelPosts.anonymous, getPost.anonymous, listPostComments.anonymous]).toEqual([
      true,
      true,
      true,
    ]);
    expect([createPost, updatePost, deletePost, likePost, getCommunityFeed]).not.toContainEqual(
      expect.objectContaining({ anonymous: true })
    );
  });

  it.each([
    { scenario: 'a text post', body: { payload: { kind: 'text', text: 'hi' } }, ok: true },
    {
      scenario: 'images with a caption',
      body: {
        payload: {
          kind: 'images',
          images: [{ uploadId: UPLOAD, alt: 'a cat' }],
          caption: null,
        },
        commentsEnabled: false,
      },
      ok: true,
    },
    {
      scenario: 'a video share at a moment',
      body: { payload: { kind: 'video_share', videoId: VIDEO, comment: null, startMs: 1500 } },
      ok: true,
    },
    {
      scenario: 'a playlist share',
      body: { payload: { kind: 'playlist_share', playlistId: VIDEO, comment: 'see' } },
      ok: true,
    },
    { scenario: 'a kind that does not exist', body: { payload: { kind: 'poll' } }, ok: false },
    {
      scenario: 'a poll, which is a later slice',
      body: { payload: { kind: 'poll', question: 'q', options: ['a', 'b'] } },
      ok: false,
    },
    {
      scenario: 'text that is not a string',
      body: { payload: { kind: 'text', text: 1 } },
      ok: false,
    },
    {
      scenario: 'an upload id that is not a uuid',
      body: {
        payload: { kind: 'images', images: [{ uploadId: 'x', alt: 'a' }], caption: null },
      },
      ok: false,
    },
    { scenario: 'no payload', body: {}, ok: false },
  ])('reads $scenario as a publish body: $ok', ({ body, ok }) => {
    expect(createPost.body.safeParse(body).success).toBe(ok);
  });

  it('publishes with replies on unless told otherwise', () => {
    expect(createPost.body.parse({ payload: { kind: 'text', text: 'hi' } }).commentsEnabled).toBe(
      true
    );
  });

  it.each([
    {
      scenario: 'a version',
      body: { payload: { kind: 'text', text: 'hi' }, version: 1 },
      ok: true,
    },
    { scenario: 'no version', body: { payload: { kind: 'text', text: 'hi' } }, ok: false },
    {
      scenario: 'version 0',
      body: { payload: { kind: 'text', text: 'hi' }, version: 0 },
      ok: false,
    },
  ])('reads $scenario as an edit body: $ok', ({ body, ok }) => {
    expect(updatePost.body.safeParse(body).success).toBe(ok);
  });

  it('leaves the replies switch alone on an edit that does not name it', () => {
    expect(
      updatePost.body.parse({ payload: { kind: 'text', text: 'hi' }, version: 2 })
    ).not.toHaveProperty('commentsEnabled');
  });

  it('answers the publish and the edit with what the caller acts on', () => {
    expect(createPost.errors).toMatchObject({
      422: [
        ErrorCodes.VALIDATION_FAILED,
        ErrorCodes.POST_SHARE_NOT_PUBLIC,
        ErrorCodes.POST_IMAGE_NOT_READY,
        ErrorCodes.POST_SCHEDULE_INVALID,
      ],
      429: [ErrorCodes.POST_DAILY_LIMIT, ErrorCodes.POST_DRAFT_LIMIT],
    });
    expect(updatePost.errors).toMatchObject({
      404: [ErrorCodes.POST_NOT_FOUND],
      409: [ErrorCodes.VERSION_CONFLICT, ErrorCodes.POST_POLL_LOCKED],
    });
  });

  it('answers the comments under a post with POST_NOT_FOUND, not VIDEO_NOT_FOUND', () => {
    expect(listPostComments.errors[404]).toEqual([ErrorCodes.POST_NOT_FOUND]);
    expect(createPostComment.errors[404]).toEqual([
      ErrorCodes.POST_NOT_FOUND,
      ErrorCodes.COMMENT_NOT_FOUND,
    ]);
  });

  it.each([
    {
      scenario: 'no timing',
      body: { payload: { kind: 'text', text: 'hi' } },
      timing: { mode: 'now' },
    },
    {
      scenario: 'a draft',
      body: { payload: { kind: 'text', text: 'hi' }, timing: { mode: 'draft' } },
      timing: { mode: 'draft' },
    },
  ])('reads $scenario on a new post as $timing', ({ body, timing }) => {
    expect(createPost.body.parse(body).timing).toEqual(timing);
  });

  it.each([
    { scenario: 'a schedule without a time', timing: { mode: 'schedule' } },
    { scenario: 'a schedule with a bad time', timing: { mode: 'schedule', publishAt: 'soon' } },
    { scenario: 'an unknown mode', timing: { mode: 'later' } },
  ])('refuses $scenario', ({ timing }) => {
    expect(
      createPost.body.safeParse({ payload: { kind: 'text', text: 'hi' }, timing }).success
    ).toBe(false);
  });

  it.each([
    {
      scenario: 'a poll',
      payload: { kind: 'poll', question: 'Q?', options: ['a', 'b'], closesAt: null },
    },
    {
      scenario: 'a quiz',
      payload: {
        kind: 'quiz',
        question: 'Q?',
        options: ['a', 'b'],
        closesAt: '2026-03-01T00:00:00.000Z',
        correctIndex: 0,
        explanation: null,
      },
    },
  ])('accepts $scenario as a payload', ({ payload }) => {
    expect(createPost.body.safeParse({ payload }).success).toBe(true);
  });

  it('never carries the author of a post', () => {
    expect(JSON.stringify(createPost.result.toJSONSchema())).not.toContain('authorUserId');
  });
});
