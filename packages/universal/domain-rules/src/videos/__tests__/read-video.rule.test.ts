import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideVideoRead } from '../read-video.rule';

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

  it('keeps forbidden distinct from missing, so two consumers can answer differently', () => {
    const video = aVideo({ visibility: 'private' });
    const result = decideVideoRead({ viewer: STRANGER, video, videoId: video.id });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it.each([
    { name: 'its owner', viewer: OWNER },
    { name: 'an admin', viewer: ADMIN },
  ])('lets $name read a private video', ({ viewer }) => {
    const video = aVideo({ visibility: 'private' });

    expect(isOk(decideVideoRead({ viewer, video, videoId: video.id }))).toBe(true);
  });

  it('names the video id on the failure so the edge can report it', () => {
    const result = decideVideoRead({ viewer: null, video: null, videoId: 'v9' });

    expect(isErr(result) && result.error.videoId).toBe('v9');
  });
});
