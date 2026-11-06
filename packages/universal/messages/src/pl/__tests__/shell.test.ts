import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl shell', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'shell.brandHome', expected: 'Strona główna Taitube' },
    { key: 'shell.trending', expected: 'Na czasie' },
    { key: 'shell.subscriptions', expected: 'Subskrypcje' },
    { key: 'shell.yourVideos', expected: 'Twoje filmy' },
    { key: 'shell.untitled', expected: 'Bez tytułu' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('names the channel in its fallback description', () => {
    expect(t('shell.channelDescription', { name: 'Ada' })).toEqual({
      ok: true,
      value: 'Filmy kanału Ada na Taitube.',
    });
  });
});
