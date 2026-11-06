import { pageHead } from '../page-head';

const BASE = {
  siteUrl: 'https://taitube.test',
  locale: 'en' as const,
  path: '/x',
  title: 'Title',
  description: 'About',
  openGraphType: 'website',
  jsonLd: { '@type': 'Thing' },
};

function metaNames(head: ReturnType<typeof pageHead>) {
  return head.meta.map((entry) =>
    'property' in entry ? entry.property : 'name' in entry ? entry.name : 'title'
  );
}

describe('apps/client/web: pageHead', () => {
  it('sets the title, canonical link, OpenGraph and Twitter summary, and the JSON-LD block', () => {
    const head = pageHead({ ...BASE, image: 'https://cdn.test/i.jpg' });

    expect(head.links[0]).toEqual({ rel: 'canonical', href: 'https://taitube.test/x' });
    expect(head.scripts).toEqual([{ type: 'application/ld+json', children: '{"@type":"Thing"}' }]);
    expect(head.meta).toEqual(
      expect.arrayContaining([
        { title: 'Title' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://taitube.test/x' },
        { property: 'og:image', content: 'https://cdn.test/i.jpg' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:image', content: 'https://cdn.test/i.jpg' },
      ])
    );
  });

  it('links the page in every supported language, the negotiated one by default, then the extra links', () => {
    const extra = { rel: 'alternate', href: 'https://taitube.test/alt', title: 'Alt' };

    expect(pageHead({ ...BASE, extraLinks: [extra] }).links).toEqual([
      { rel: 'canonical', href: 'https://taitube.test/x' },
      { rel: 'alternate', hrefLang: 'en', href: 'https://taitube.test/x?lang=en' },
      { rel: 'alternate', hrefLang: 'pl', href: 'https://taitube.test/x?lang=pl' },
      { rel: 'alternate', hrefLang: 'x-default', href: 'https://taitube.test/x' },
      extra,
    ]);
  });

  it.each([
    { locale: 'en', current: 'en_US', alternate: 'pl_PL' },
    { locale: 'pl', current: 'pl_PL', alternate: 'en_US' },
  ] as const)(
    'names $locale as the OpenGraph locale and the others as its alternates',
    ({ locale, current, alternate }) => {
      const { meta } = pageHead({ ...BASE, locale });

      expect(meta).toContainEqual({ property: 'og:locale', content: current });
      expect(meta).toContainEqual({ property: 'og:locale:alternate', content: alternate });
    }
  );

  it('has no image tags without an image', () => {
    expect(metaNames(pageHead(BASE))).not.toContain('og:image');
  });

  it('flattens the description and cuts it at 200 characters', () => {
    const head = pageHead({ ...BASE, description: `line one\n\n${'word '.repeat(80)}` });

    const description = head.meta.find((entry) => 'name' in entry && entry.name === 'description');
    expect(description).toMatchObject({
      content: expect.stringMatching(/^line one word word.*…$/),
    });
    expect(description && 'content' in description && description.content).toHaveLength(200);
  });
});
