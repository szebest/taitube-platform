import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { AUTHOR, aComment, aVideo } from '../../__tests__/entities';
import { type CreateCommentInput, decideCommentCreate } from '../create-comment.rule';

const video = aVideo();

function input(overrides: Partial<CreateCommentInput> = {}): CreateCommentInput {
  return {
    author: AUTHOR,
    video,
    videoId: video.id,
    parent: null,
    parentId: null,
    content: 'nice',
    ...overrides,
  };
}

describe('@vp/domain-rules: decideCommentCreate', () => {
  it('opens a new thread with the normalised content', () => {
    const result = decideCommentCreate(input({ content: '  nice  ' }));

    expect(isOk(result) && result.value).toEqual({ video, parentId: null, content: 'nice' });
  });

  it('threads a reply under the root it answers', () => {
    const root = aComment({ id: 'root-1' });

    const result = decideCommentCreate(input({ parent: root, parentId: root.id }));

    expect(isOk(result) && result.value.parentId).toBe('root-1');
  });

  it('joins a reply to a reply to the root, keeping one level of nesting', () => {
    const reply = aComment({ id: 'reply-1', parentId: 'root-1' });

    const result = decideCommentCreate(input({ parent: reply, parentId: reply.id }));

    expect(isOk(result) && result.value.parentId).toBe('root-1');
  });

  it.each([
    {
      scenario: 'an anonymous author',
      overrides: { author: null },
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      scenario: 'an absent video',
      overrides: { video: null },
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'a video the author may not read',
      overrides: { video: aVideo({ visibility: 'private' }) },
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'a parent that is not there',
      overrides: { parentId: 'gone' },
      code: ErrorCodes.COMMENT_NOT_FOUND,
    },
    {
      scenario: 'a parent under another video',
      overrides: { parent: aComment({ videoId: 'video-2' }), parentId: 'comment-1' },
      code: ErrorCodes.COMMENT_NOT_FOUND,
    },
    {
      scenario: 'blank content',
      overrides: { content: '   ' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario with $code', ({ overrides, code }) => {
    const result = decideCommentCreate(input(overrides));

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
