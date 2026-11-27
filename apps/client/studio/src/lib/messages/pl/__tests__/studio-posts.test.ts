import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/studio: pl studio posts', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.postsNav', expected: 'Posty' },
    { key: 'studio.postsNew', expected: 'Nowy post' },
    { key: 'studio.composerOptionAdd', expected: 'Dodaj odpowiedź' },
    { key: 'studio.statsQuizNone', expected: 'Nikt jeszcze nie odpowiedział.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'studio.postsKind', args: { kind: 'poll' }, expected: 'Ankieta' },
    { key: 'studio.postsStatus', args: { status: 'draft' }, expected: 'Szkic' },
    { key: 'studio.postsSaved', args: { mode: 'now' }, expected: 'Post opublikowany' },
    { key: 'studio.composerSubmit', args: { mode: 'schedule' }, expected: 'Zaplanuj' },
    { key: 'studio.composerCount', args: { count: 12, max: 140 }, expected: '12 z 140' },
    { key: 'studio.statsOptionVotes', args: { count: 1 }, expected: '1 głos' },
    { key: 'studio.statsOptionVotes', args: { count: 3 }, expected: '3 głosy' },
    { key: 'studio.statsOptionVotes', args: { count: 5 }, expected: '5 głosów' },
    { key: 'studio.statsOptionVotes', args: { count: 22 }, expected: '22 głosy' },
    { key: 'studio.commentsTargetChip', args: { type: 'video' }, expected: 'Film' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
