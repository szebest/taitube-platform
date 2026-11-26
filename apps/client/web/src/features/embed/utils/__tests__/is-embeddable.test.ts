import { video } from '@vp/web-testing';
import { isEmbeddable } from '../is-embeddable';

const LINK_ID = '0190c3a0-5e1d-7000-8000-0000000000e1';

describe('apps/client/web: isEmbeddable', () => {
  it.each([
    { read: 'a public video', overrides: {}, embeddable: true },
    { read: 'a private one', overrides: { visibility: 'private' as const }, embeddable: false },
    { read: 'an unlisted one', overrides: { visibility: 'unlisted' as const }, embeddable: false },
    {
      read: 'a private one through a share link',
      overrides: { visibility: 'private' as const, shareLinkId: LINK_ID },
      embeddable: true,
    },
    {
      read: 'an unlisted one its password unlocked',
      overrides: { visibility: 'unlisted' as const, passwordProtected: true },
      embeddable: true,
    },
    {
      read: 'one still processing',
      overrides: { status: 'PROCESSING' as const },
      embeddable: false,
    },
  ])('plays $read: $embeddable', ({ overrides, embeddable }) => {
    expect(isEmbeddable(video(overrides))).toBe(embeddable);
  });
});
