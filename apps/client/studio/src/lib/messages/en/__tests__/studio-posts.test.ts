import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/studio: en studio posts', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.postsNav', expected: 'Posts' },
    { key: 'studio.postsNew', expected: 'New post' },
    { key: 'studio.composerOptionAdd', expected: 'Add option' },
    { key: 'studio.statsQuizNone', expected: 'Nobody has answered yet.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'studio.postsKind', args: { kind: 'video_share' }, expected: 'Video' },
    { key: 'studio.postsStatus', args: { status: 'scheduled' }, expected: 'Scheduled' },
    { key: 'studio.postsFilterOption', args: { filter: 'draft' }, expected: 'Drafts' },
    { key: 'studio.postsSaved', args: { mode: 'schedule' }, expected: 'Post scheduled' },
    { key: 'studio.composerSubmit', args: { mode: 'draft' }, expected: 'Save draft' },
    {
      key: 'studio.composerProblem',
      args: { reason: 'past' },
      expected: 'Pick a time in the future.',
    },
    { key: 'studio.composerCount', args: { count: 2012, max: 2000 }, expected: '2,012 of 2,000' },
    { key: 'studio.composerOption', args: { position: 3 }, expected: 'Option 3' },
    { key: 'studio.statsOptionVotes', args: { count: 1 }, expected: '1 vote' },
    { key: 'studio.statsOptionVotes', args: { count: 3 }, expected: '3 votes' },
    { key: 'studio.commentsTargetChip', args: { type: 'post' }, expected: 'Post' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
