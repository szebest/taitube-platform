import { playlistHref } from '../playlist-href';

describe('apps/client/web: playlist href', () => {
  it('names the playlist in the list parameter, escaped', () => {
    expect(playlistHref('abc')).toBe('/playlist?list=abc');
    expect(playlistHref('a b&c')).toBe('/playlist?list=a+b%26c');
  });
});
