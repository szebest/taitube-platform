import { isErr, isOk } from '@kit/result';
import type { CommentHost } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aPost, aVideo, videoHost } from '../../__tests__/entities';
import {
  commentHostTarget,
  commentHostTraits,
  commentOwnership,
  commentTargetNotFound,
  decideCommentHostRead,
  publicHostReadFailure,
} from '../comment-host';

const postHost = (overrides = {}): CommentHost => ({
  type: 'post',
  post: aPost(overrides),
  ownerId: OWNER.id,
});

describe('@vp/domain-rules: comment host', () => {
  it.each([
    { name: 'a video', host: videoHost(aVideo()), target: { type: 'video', id: 'video-1' } },
    { name: 'a post', host: postHost(), target: { type: 'post', id: 'post-1' } },
  ])('targets $name by its id', ({ host, target }) => {
    expect(commentHostTarget(host)).toEqual(target);
  });

  it.each([
    {
      name: 'a video that has not set the toggle or the count',
      host: videoHost(aVideo()),
      traits: {
        channelId: 'channel-1',
        ownerId: OWNER.id,
        commentsEnabled: true,
        commentsCount: 0,
      },
    },
    {
      name: 'a video with comments off',
      host: videoHost(aVideo({ commentsEnabled: false, commentsCount: 4 })),
      traits: {
        channelId: 'channel-1',
        ownerId: OWNER.id,
        commentsEnabled: false,
        commentsCount: 4,
      },
    },
    {
      name: 'a post, owned by the host owner',
      host: postHost({ commentsEnabled: false, commentsCount: 7 }),
      traits: {
        channelId: 'channel-1',
        ownerId: OWNER.id,
        commentsEnabled: false,
        commentsCount: 7,
      },
    },
  ])('reads the traits of $name', ({ host, traits }) => {
    expect(commentHostTraits(host)).toEqual(traits);
  });

  it.each([
    { name: 'a video', host: videoHost(aVideo()) },
    { name: 'a post', host: postHost() },
  ])('names the creator and the channel of $name for the permissions', ({ host }) => {
    expect(commentOwnership(host)).toEqual({
      videoOwnerId: OWNER.id,
      videoChannelId: 'channel-1',
    });
  });

  it.each([
    { name: 'a public video', host: videoHost(aVideo()), viewer: null },
    { name: 'a published post', host: postHost(), viewer: null },
  ])('lets anyone read the comments of $name', ({ host, viewer }) => {
    const result = decideCommentHostRead(viewer, host);

    expect(isOk(result) && result.value).toBe(host);
  });

  it.each([
    {
      name: 'a draft post',
      host: postHost({ status: 'draft' }),
      viewer: OWNER,
      code: ErrorCodes.POST_NOT_FOUND,
    },
    {
      name: 'a private video to a stranger',
      host: videoHost(aVideo({ visibility: 'private' })),
      viewer: STRANGER,
      code: ErrorCodes.FORBIDDEN,
    },
    {
      name: 'a private video to nobody',
      host: videoHost(aVideo({ visibility: 'private' })),
      viewer: null,
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])('refuses $name', ({ host, viewer, code }) => {
    const result = decideCommentHostRead(viewer, host);

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it.each([
    {
      name: 'a post refusal, which is already the disguise',
      host: postHost({ status: 'draft' }),
      viewer: OWNER,
      code: ErrorCodes.POST_NOT_FOUND,
    },
    {
      name: 'a private video of a stranger, disguised as absent',
      host: videoHost(aVideo({ visibility: 'private' })),
      viewer: STRANGER,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      name: 'a private video of nobody, kept as a sign-in',
      host: videoHost(aVideo({ visibility: 'private' })),
      viewer: null,
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])('shows the public a refusal of $name', ({ host, viewer, code }) => {
    const result = decideCommentHostRead(viewer, host);

    expect(isErr(result) && publicHostReadFailure(result.error).code).toBe(code);
  });

  it.each([
    {
      name: 'a video',
      target: { type: 'video', id: 'v-9' } as const,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      name: 'a post',
      target: { type: 'post', id: 'p-9' } as const,
      code: ErrorCodes.POST_NOT_FOUND,
    },
  ])('refuses a missing $name as not found', ({ target, code }) => {
    expect(commentTargetNotFound(target)).toMatchObject({ code });
  });
});
