import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideEmbedTarget } from '../embed-target.rule';

const WEB = 'https://taitube.test';
const ID = '0191a2b3-c4d5-7e6f-8a9b-0c1d2e3f4a5b';

describe('@vp/domain-rules: decideEmbedTarget', () => {
  it.each([
    { scenario: 'a watch URL', url: `${WEB}/watch/${ID}` },
    { scenario: 'a trailing slash', url: `${WEB}/watch/${ID}/` },
    { scenario: 'a start time', url: `${WEB}/watch/${ID}?t=30` },
    { scenario: 'a fragment', url: `${WEB}/watch/${ID}#comments` },
    { scenario: 'an upper-case id', url: `${WEB}/watch/${ID.toUpperCase()}` },
  ])('names the video of $scenario', ({ url }) => {
    expect(expectOk(decideEmbedTarget({ url, webUrl: WEB }))).toEqual({ videoId: ID });
  });

  it('reads the origin from a web URL that carries a path', () => {
    expectOk(decideEmbedTarget({ url: `${WEB}/watch/${ID}`, webUrl: `${WEB}/` }));
  });

  it.each([
    { scenario: 'not a URL', url: 'taitube' },
    { scenario: 'another host', url: `https://example.com/watch/${ID}` },
    { scenario: 'another scheme', url: `http://taitube.test/watch/${ID}` },
    { scenario: 'another port', url: `https://taitube.test:8443/watch/${ID}` },
    { scenario: 'a look-alike host', url: `https://taitube.test.evil.com/watch/${ID}` },
    { scenario: 'the home page', url: `${WEB}/` },
    { scenario: 'a channel page', url: `${WEB}/channel/${ID}` },
    { scenario: 'a watch URL with no id', url: `${WEB}/watch/` },
    { scenario: 'a watch URL with a bad id', url: `${WEB}/watch/not-a-uuid` },
    { scenario: 'a nested watch path', url: `${WEB}/watch/${ID}/more` },
  ])('refuses $scenario', ({ url }) => {
    expect(expectErr(decideEmbedTarget({ url, webUrl: WEB }))).toMatchObject({
      code: ErrorCodes.OEMBED_URL_UNSUPPORTED,
      url,
    });
  });

  it('refuses everything when the web origin is not a URL', () => {
    expect(
      expectErr(decideEmbedTarget({ url: `${WEB}/watch/${ID}`, webUrl: 'nope' }))
    ).toMatchObject({ code: ErrorCodes.OEMBED_URL_UNSUPPORTED });
  });
});
