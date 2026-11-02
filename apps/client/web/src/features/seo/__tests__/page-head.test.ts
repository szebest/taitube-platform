import { pageHead } from '../page-head';

const BASE = {
  siteUrl: 'https://taitube.test',
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

    expect(head.links).toEqual([{ rel: 'canonical', href: 'https://taitube.test/x' }]);
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

  it('puts the extra links after the canonical one', () => {
    const extra = { rel: 'alternate', href: 'https://taitube.test/alt', title: 'Alt' };

    expect(pageHead({ ...BASE, extraLinks: [extra] }).links).toEqual([
      { rel: 'canonical', href: 'https://taitube.test/x' },
      extra,
    ]);
  });

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
