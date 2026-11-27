import { avatarSrcSet } from '../avatar-src-set';

describe('apps/client/web: avatarSrcSet', () => {
  it('lists every size by its width, smallest first, whatever order the files arrive in', () => {
    const sizes = {
      '256': '/a-256.webp',
      '48': '/a-48.webp',
      '128': '/a-128.webp',
      '72': '/a-72.webp',
    };

    expect(avatarSrcSet({ sizes })).toBe(
      '/a-48.webp 48w, /a-72.webp 72w, /a-128.webp 128w, /a-256.webp 256w'
    );
  });
});
