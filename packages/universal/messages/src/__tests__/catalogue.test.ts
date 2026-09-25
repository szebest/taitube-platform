import { findMessage } from '../catalogue';
import { en } from '../en';

describe('@vp/messages: findMessage', () => {
  it('finds a message by its dot path', () => {
    expect(findMessage(en, 'videos.views')).toBe(en.videos.views);
  });

  it.each([
    { scenario: 'an unknown feature', catalogue: en, key: 'players.views' },
    { scenario: 'an unknown message', catalogue: en, key: 'videos.gone' },
    { scenario: 'a locale with no catalogue', catalogue: undefined, key: 'videos.views' },
  ])('finds nothing for $scenario', ({ catalogue, key }) => {
    expect(findMessage(catalogue, key)).toBeUndefined();
  });
});
