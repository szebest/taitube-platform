import { ErrorCodes } from '@vp/errors';
import { oembedFormatUnsupported, oembedUrlUnsupported } from '../failures';

describe('@vp/domain-rules: oEmbed failures', () => {
  it('names the url that was refused', () => {
    expect(oembedUrlUnsupported('https://x.test/')).toMatchObject({
      code: ErrorCodes.OEMBED_URL_UNSUPPORTED,
      url: 'https://x.test/',
    });
  });

  it('names the format that was refused', () => {
    expect(oembedFormatUnsupported('xml')).toMatchObject({
      code: ErrorCodes.OEMBED_FORMAT_UNSUPPORTED,
      format: 'xml',
    });
  });
});
