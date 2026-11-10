import { SOCIAL_TARGETS } from '../social-targets';

const LINK = 'https://taitube.example/watch/abc?t=5';
const TITLE = 'A title & more';

describe('apps/client/web: social share targets', () => {
  it.each([
    {
      id: 'x',
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(LINK)}&text=${encodeURIComponent(TITLE)}`,
    },
    {
      id: 'facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(LINK)}`,
    },
    {
      id: 'whatsapp',
      href: `https://wa.me/?text=${encodeURIComponent(`${TITLE} ${LINK}`)}`,
    },
    {
      id: 'telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(LINK)}&text=${encodeURIComponent(TITLE)}`,
    },
    {
      id: 'reddit',
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(LINK)}&title=${encodeURIComponent(TITLE)}`,
    },
    {
      id: 'email',
      href: `mailto:?subject=${encodeURIComponent(TITLE)}&body=${encodeURIComponent(LINK)}`,
    },
  ] as const)('builds the $id link from the url and the title', ({ id, href }) => {
    const target = SOCIAL_TARGETS.find((candidate) => candidate.id === id);

    expect(target?.href({ url: LINK, title: TITLE })).toBe(href);
  });

  it('lists each target once', () => {
    const ids = SOCIAL_TARGETS.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
