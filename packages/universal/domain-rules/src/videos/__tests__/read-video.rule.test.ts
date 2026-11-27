import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { videoForbidden, videoNotFound, videoReadRequiresAuth } from '../failures';
import { decideVideoRead, publicReadFailure } from '../read-video.rule';

describe('@vp/domain-rules: decideVideoRead', () => {
  it('returns the video when the viewer may read it', () => {
    const video = aVideo();
    const result = decideVideoRead({ viewer: null, video, videoId: video.id });

    expect(isOk(result) && result.value).toBe(video);
  });

  it('reports an absent row as VIDEO_NOT_FOUND', () => {
    const result = decideVideoRead({ viewer: OWNER, video: null, videoId: 'gone' });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it.each([
    { name: 'a signed-in stranger', viewer: STRANGER, code: ErrorCodes.FORBIDDEN },
    { name: 'an anonymous caller', viewer: null, code: ErrorCodes.UNAUTHORIZED },
  ])('answers $name with $code, all three kept distinct from missing', ({ viewer, code }) => {
    const video = aVideo({ visibility: 'private' });
    const result = decideVideoRead({ viewer, video, videoId: video.id });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it.each([
    { name: 'its owner', viewer: OWNER },
    { name: 'an admin', viewer: ADMIN },
  ])('lets $name read a private video', ({ viewer }) => {
    const video = aVideo({ visibility: 'private' });

    expect(isOk(decideVideoRead({ viewer, video, videoId: video.id }))).toBe(true);
  });

  it.each([
    { name: 'its own link', targetId: 'video-1', readable: true },
    { name: 'the link of another video', targetId: 'video-2', readable: false },
  ])(
    'lets an anonymous caller holding $name read a private video: $readable',
    ({ targetId, readable }) => {
      const video = aVideo({ visibility: 'private' });
      const share = { targetType: 'video', targetId } as const;

      expect(isOk(decideVideoRead({ viewer: null, video, videoId: video.id, share }))).toBe(
        readable
      );
    }
  );

  it('names the video id on the failure so the edge can report it', () => {
    const result = decideVideoRead({ viewer: null, video: null, videoId: 'v9' });

    expect(isErr(result) && result.error.videoId).toBe('v9');
  });
});

describe('@vp/domain-rules: publicReadFailure', () => {
  it.each([
    { name: 'a forbidden read', failure: videoForbidden('v1'), code: ErrorCodes.VIDEO_NOT_FOUND },
    { name: 'an absent video', failure: videoNotFound('v1'), code: ErrorCodes.VIDEO_NOT_FOUND },
    {
      name: 'an anonymous caller',
      failure: videoReadRequiresAuth('v1'),
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])('reports $name as $code', ({ failure, code }) => {
    expect(publicReadFailure(failure).code).toBe(code);
  });

  it('keeps the video id, so the edge can still name what it refused', () => {
    expect(publicReadFailure(videoForbidden('v9')).videoId).toBe('v9');
  });
});
