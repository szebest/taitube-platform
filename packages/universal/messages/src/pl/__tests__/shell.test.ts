import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl shell', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'shell.brandHome', expected: 'Strona główna Taitube' },
    { key: 'shell.trending', expected: 'Na czasie' },
    { key: 'shell.subscriptions', expected: 'Subskrypcje' },
    { key: 'shell.yourVideos', expected: 'Twoje filmy' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
