import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl channels', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'channels.subscribe', expected: 'Subskrybuj' },
    { key: 'channels.subscribed', expected: 'Subskrybujesz' },
    { key: 'channels.subscriptionsTitle', expected: 'Twoje subskrypcje' },
    { key: 'channels.yourVideos', expected: 'Twoje filmy' },
    { key: 'channels.viewChannel', expected: 'Zobacz kanał' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'channels.handle', args: { handle: 'lasy' }, expected: '@lasy' },
    { key: 'channels.subscribers', args: { count: 1 }, expected: '1 subskrybent' },
    { key: 'channels.subscribers', args: { count: 3 }, expected: '3 subskrybentów' },
    { key: 'channels.subscribers', args: { count: 5 }, expected: '5 subskrybentów' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
