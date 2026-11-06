import { isEmbedPath } from '../embed-path';

describe('apps/client/web: isEmbedPath', () => {
  it.each([
    { path: '/embed/0190c3a0', embed: true },
    { path: '/embed/', embed: true },
    { path: '/embed', embed: false },
    { path: '/watch/0190c3a0', embed: false },
    { path: '/embedded/x', embed: false },
  ])('reads $path as embed: $embed', ({ path, embed }) => {
    expect(isEmbedPath(path)).toBe(embed);
  });
});
