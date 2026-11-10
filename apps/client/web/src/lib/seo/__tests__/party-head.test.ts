import { FALLBACK_ACTIVE_LOCALE } from '@vp/intl-react';
import { partyPreview } from '@vp/web-testing';
import { headWords } from '../head-words';
import { partyHead } from '../party-head';

const SITE = 'https://taitube.test';
const WORDS = headWords(FALLBACK_ACTIVE_LOCALE);
const THUMBNAIL = 'http://localhost:9000/posters/p.jpg';

function head(overrides: Parameters<typeof partyPreview>[0] = {}) {
  return partyHead(
    partyPreview({
      presentCount: 3,
      currentVideo: {
        id: 'v1',
        title: 'Big Buck Bunny',
        durationMs: 600_000,
        thumbnailUrl: THUMBNAIL,
      },
      ...overrides,
    }),
    SITE,
    WORDS
  );
}

describe('apps/client/web: partyHead', () => {
  it.each(['public', 'unlisted', 'private'] as const)('is noindex for a %s room', (visibility) => {
    expect(head({ visibility }).meta).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    });
  });

  it.each(['public', 'unlisted'] as const)(
    'unfurls a %s room with its name, its video and who is watching',
    (visibility) => {
      const { meta } = head({ visibility, name: 'Movie night' });

      expect(meta).toContainEqual({ title: 'Movie night - watch party' });
      expect(meta).toContainEqual({
        name: 'description',
        content: 'Watching Big Buck Bunny with 3 people',
      });
      expect(meta).toContainEqual({ property: 'og:image', content: THUMBNAIL });
    }
  );

  it('unfurls a private room with the generic invitation, no name and no image', () => {
    const { meta } = head({ visibility: 'private', name: 'Secret club' });
    const text = JSON.stringify(meta);

    expect(meta).toContainEqual({ title: 'Join a watch party on Taitube' });
    expect(text).not.toContain('Secret club');
    expect(meta.some((entry) => 'property' in entry && entry.property === 'og:image')).toBe(false);
  });

  it('links the room canonical URL', () => {
    const room = partyPreview();

    expect(head().links[0]).toEqual({ rel: 'canonical', href: `${SITE}/parties/${room.id}` });
  });
});
