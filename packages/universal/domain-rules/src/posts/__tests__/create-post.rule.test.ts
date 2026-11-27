import { isErr, isOk } from '@kit/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aPost } from '../../__tests__/entities';
import {
  type CreatePostInput,
  type EditPostInput,
  decidePostCreate,
  decidePostEdit,
} from '../create-post.rule';

const channel = { id: 'channel-1', ownerId: OWNER.id };
const text = (value: string): PostPayload => ({ kind: 'text', text: value });
const videoShare: PostPayload = {
  kind: 'video_share',
  videoId: 'v-1',
  comment: ' ',
  startMs: null,
};
const publicVideo = { type: 'video', id: 'v-1', visibility: 'public', status: 'READY' } as const;
const privateVideo = { ...publicVideo, visibility: 'private' } as const;

function createInput(overrides: Partial<CreatePostInput> = {}): CreatePostInput {
  return {
    actor: OWNER,
    channel,
    payload: text(' hello '),
    shared: null,
    createdToday: 0,
    ...overrides,
  };
}

function editInput(overrides: Partial<EditPostInput> = {}): EditPostInput {
  return {
    actor: OWNER,
    channel,
    post: aPost(),
    postId: 'post-1',
    payload: text(' edited '),
    shared: null,
    ...overrides,
  };
}

describe('@vp/domain-rules: decidePostCreate', () => {
  it.each([
    { name: 'a text', overrides: {}, payload: text('hello') },
    {
      name: 'a video share with a blank comment',
      overrides: { payload: videoShare, shared: publicVideo },
      payload: { ...videoShare, comment: null },
    },
  ])('returns the normalized payload of $name', ({ overrides, payload }) => {
    const result = decidePostCreate(createInput(overrides));

    expect(isOk(result) && result.value).toEqual({ payload });
  });

  it.each([
    { name: 'an anonymous caller', overrides: { actor: null }, code: ErrorCodes.UNAUTHORIZED },
    { name: 'a stranger', overrides: { actor: STRANGER }, code: ErrorCodes.FORBIDDEN },
    {
      name: 'a stranger over the daily limit, who is told only of the permission',
      overrides: { actor: STRANGER, createdToday: 20, payload: text('') },
      code: ErrorCodes.FORBIDDEN,
    },
    {
      name: 'an invalid payload, before the limit',
      overrides: { payload: text('  '), createdToday: 20 },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'a channel at the daily limit, before the share',
      overrides: { createdToday: 20, payload: videoShare, shared: privateVideo },
      code: ErrorCodes.POST_DAILY_LIMIT,
    },
    {
      name: 'a private video',
      overrides: { payload: videoShare, shared: privateVideo },
      code: ErrorCodes.POST_SHARE_NOT_PUBLIC,
    },
  ])('refuses $name', ({ overrides, code }) => {
    const result = decidePostCreate(createInput(overrides));

    expect(isErr(result) && result.error.code).toBe(code);
  });
});

describe('@vp/domain-rules: decidePostEdit', () => {
  it('returns the normalized payload for a post of the channel', () => {
    const result = decidePostEdit(editInput());

    expect(isOk(result) && result.value).toEqual({ payload: text('edited') });
  });

  it.each([
    { name: 'an anonymous caller', overrides: { actor: null }, code: ErrorCodes.UNAUTHORIZED },
    { name: 'a stranger', overrides: { actor: STRANGER }, code: ErrorCodes.FORBIDDEN },
    {
      name: 'a post of another channel',
      overrides: { post: aPost({ channelId: 'channel-2' }) },
      code: ErrorCodes.POST_NOT_FOUND,
    },
    { name: 'a missing post', overrides: { post: null }, code: ErrorCodes.POST_NOT_FOUND },
    {
      name: 'an invalid payload',
      overrides: { payload: text('a'.repeat(2001)) },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'a private video',
      overrides: { payload: videoShare, shared: privateVideo },
      code: ErrorCodes.POST_SHARE_NOT_PUBLIC,
    },
  ])('refuses $name', ({ overrides, code }) => {
    const result = decidePostEdit(editInput(overrides));

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
