import { decideVideoRead } from '@vp/domain-rules';
import { isErr, isOk } from '@vp/result';
import { ALLOWED_CONTENT_TYPES, validateStartUpload } from '@vp/validation';

/**
 * The client tier consuming both rule packages for real. `@vp/api-client` is `client`-tier, so
 * this file only compiles and only runs if `@vp/validation` and `@vp/domain-rules` are genuinely
 * browser-reachable - which is the claim tickets 53, 70 and 71 build on.
 */
describe('client tier: the shared rules are reachable from a browser-only package', () => {
  it('runs the input rule the backend runs, before any network call', () => {
    const limits = { maxBytes: 100, allowedContentTypes: ALLOWED_CONTENT_TYPES };

    const tooBig = validateStartUpload(
      { filename: 'clip.mp4', sizeBytes: 101, contentType: 'video/mp4' },
      limits
    );
    const fine = validateStartUpload(
      { filename: 'clip.mp4', sizeBytes: 10, contentType: 'video/mp4' },
      limits
    );

    expect(isErr(tooBig)).toBe(true);
    expect(isOk(fine)).toBe(true);
  });

  it('runs a domain rule against a plain entity object, as a query cache would hold it', () => {
    const video = {
      id: 'video-1',
      ownerId: 'user-1',
      title: 'Clip',
      description: null,
      visibility: 'public',
      status: 'READY',
      sourceKey: 'video-1/source.mp4',
      sourceSizeBytes: 1,
      durationMs: 1,
      width: 1,
      height: 1,
      ladder: null,
      generation: 1,
      version: 1,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      readyAt: new Date(0),
    } as const;

    expect(isOk(decideVideoRead({ viewer: null, video, videoId: video.id }))).toBe(true);
    expect(isErr(decideVideoRead({ viewer: null, video: null, videoId: 'gone' }))).toBe(true);
  });
});
