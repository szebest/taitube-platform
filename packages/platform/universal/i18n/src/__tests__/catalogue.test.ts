import { findMessage } from '../catalogue';
import { source } from './fixtures';

describe('@kit/i18n: findMessage', () => {
  it.each([
    { key: 'videos.views', expected: source.videos.views },
    { key: 'videos.gone', expected: undefined },
    { key: 'gone.views', expected: undefined },
    { key: 'videos', expected: undefined },
  ])('finds $key', ({ key, expected }) => {
    expect(findMessage(source, key)).toBe(expected);
  });

  it('finds nothing in no catalogue', () => {
    expect(findMessage(undefined, 'videos.views')).toBeUndefined();
  });
});
