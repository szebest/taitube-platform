import { isErr, isOk } from '@kit/result';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decidePostImages } from '../post-images.rule';

const images = (...ids: string[]): PostPayload => ({
  kind: 'images',
  images: ids.map((uploadId) => ({ uploadId, alt: 'alt' })),
  caption: null,
});

describe('@vp/domain-rules: decidePostImages', () => {
  it.each([
    { name: 'images that are all ready', payload: images('a', 'b'), ready: ['a', 'b', 'c'] },
    { name: 'a text', payload: { kind: 'text', text: 'x' } as PostPayload, ready: [] },
  ])('accepts $name', ({ payload, ready }) => {
    expect(isOk(decidePostImages({ payload, readyUploadIds: new Set(ready) }))).toBe(true);
  });

  it.each([
    {
      name: 'an upload that is not ready or not of the channel',
      payload: images('a', 'x'),
      ready: ['a'],
      uploadId: 'x',
    },
    { name: 'no ready upload at all', payload: images('a'), ready: [], uploadId: 'a' },
  ])('refuses $name and names it', ({ payload, ready, uploadId }) => {
    const result = decidePostImages({ payload, readyUploadIds: new Set(ready) });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.POST_IMAGE_NOT_READY,
      uploadId,
    });
  });
});
