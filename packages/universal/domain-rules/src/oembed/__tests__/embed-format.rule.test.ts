import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideEmbedFormat } from '../embed-format.rule';

describe('@vp/domain-rules: decideEmbedFormat', () => {
  it('serves json', () => {
    expect(expectOk(decideEmbedFormat('json'))).toBe('json');
  });

  it.each(['xml', 'yaml', ''])('answers %j with the spec 501 failure', (format) => {
    expect(expectErr(decideEmbedFormat(format))).toMatchObject({
      code: ErrorCodes.OEMBED_FORMAT_UNSUPPORTED,
      format,
    });
  });
});
