import { richTextImageIds, richTextTree } from '../rich-text-tree';

const IMAGE = '0195A1B2-C3D4-7E5F-8A6B-7C8D9E0F1A2B';

describe('@vp/validation: richTextTree', () => {
  it('builds the whitelisted tree, with the page images by their lower-case id', () => {
    const tree = richTextTree(
      [
        '## Welcome',
        '',
        'A **bold** [link](https://example.com).  ',
        'Next line.',
        '',
        '1. one',
        '2. two',
        '',
        `![Banner](page-image:${IMAGE})`,
      ].join('\n')
    );

    expect(tree.map((block) => block.type)).toEqual(['heading', 'paragraph', 'list', 'paragraph']);
    expect(tree[2]).toMatchObject({ type: 'list', ordered: true });
    expect(richTextImageIds(tree)).toEqual([IMAGE.toLowerCase()]);
  });

  it.each([
    { scenario: 'an h1', body: '# Title' },
    { scenario: 'a quote', body: '> quoted' },
    { scenario: 'an image that is a URL', body: '![x](https://example.com/a.png)\n' },
  ])('leaves out $scenario', ({ body }) => {
    expect(richTextImageIds(richTextTree(body))).toEqual([]);
    expect(richTextTree(body).every((block) => block.type !== 'heading')).toBe(true);
  });
});
