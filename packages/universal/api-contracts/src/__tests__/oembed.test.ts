import { getOEmbed } from '../oembed';

describe('packages/api-contracts: oembed', () => {
  it('serves GET /v1/oembed to anyone', () => {
    expect(getOEmbed).toMatchObject({
      method: 'GET',
      path: '/v1/oembed',
      status: 200,
      anonymous: true,
    });
  });

  it.each([
    { scenario: 'a url alone', query: { url: 'https://x.test/watch/1' }, format: 'json' },
    { scenario: 'an xml request', query: { url: 'u', format: 'xml' }, format: 'xml' },
  ])('reads $scenario, defaulting the format to json', ({ query, format }) => {
    expect(getOEmbed.query.parse(query)).toMatchObject({ format });
  });

  it('reads the ceilings off a query string as numbers', () => {
    expect(getOEmbed.query.parse({ url: 'u', maxwidth: '320', maxheight: '200' })).toMatchObject({
      maxwidth: 320,
      maxheight: 200,
    });
  });

  it.each([
    { scenario: 'no url', query: {} },
    { scenario: 'an empty url', query: { url: '' } },
    { scenario: 'another format', query: { url: 'u', format: 'yaml' } },
    { scenario: 'a zero ceiling', query: { url: 'u', maxwidth: '0' } },
    { scenario: 'a fractional ceiling', query: { url: 'u', maxheight: '1.5' } },
    { scenario: 'a text ceiling', query: { url: 'u', maxwidth: 'wide' } },
  ])('refuses $scenario', ({ query }) => {
    expect(getOEmbed.query.safeParse(query).success).toBe(false);
  });

  it('describes the response a client may read', () => {
    const embed = {
      type: 'video',
      version: '1.0',
      provider_name: 'Taitube',
      provider_url: 'https://x.test',
      html: '<iframe></iframe>',
      width: 640,
      height: 360,
    };

    expect(getOEmbed.result.safeParse(embed).success).toBe(true);
    expect(getOEmbed.result.safeParse({ ...embed, type: 'rich' }).success).toBe(false);
  });
});
