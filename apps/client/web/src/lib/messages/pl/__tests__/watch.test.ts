import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/web: pl watch', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'watch.subscribe', expected: 'Subskrybuj' },
    { key: 'watch.moreLikeThis', expected: 'Podobne filmy' },
    { key: 'watch.shareTitle', expected: 'Udostępnij ten film' },
    { key: 'watch.linkCopied', expected: 'Link skopiowany' },
    { key: 'watch.queueEmpty', expected: 'Kolejka jest pusta' },
    { key: 'watch.playNext', expected: 'Odtwórz jako następny' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'watch.shareStartAt', args: { time: '1:30' }, expected: 'Zacznij od 1:30' },
    { key: 'watch.queuePosition', args: { position: 2, count: 12 }, expected: '2 / 12' },
    { key: 'watch.queueSegment', args: { start: '0:30', end: '1:45' }, expected: '0:30 do 1:45' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      name: 'a moderation action',
      written: () => t('watch.moderateAction', { action: 'shadow_ban' }),
      expected: 'Cichy ban użytkownika',
    },
    {
      name: 'a moderation reason',
      written: () => t('watch.moderationReason', { reason: 'off_topic' }),
      expected: 'Nie na temat',
    },
    {
      name: 'a ban length',
      written: () => t('watch.moderationDuration', { duration: '24h' }),
      expected: '24 godziny',
    },
    {
      name: 'the slow mode wait',
      written: () => t('watch.commentsSlowMode', { seconds: 12 }),
      expected: 'Poczekaj 12 s',
    },
  ])('writes $name', ({ written, expected }) => {
    expect(written()).toEqual({ ok: true, value: expected });
  });

  it('names a report reason', () => {
    expect(t('watch.reportReason', { reason: 'hate' })).toEqual({
      ok: true,
      value: 'Mowa nienawiści',
    });
  });
});
