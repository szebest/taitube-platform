import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideVideoMetadataUpdate } from '../update-metadata.rule';

const video = aVideo();

describe('@vp/domain-rules: decideVideoMetadataUpdate', () => {
  it('accepts a valid patch from the owner', () => {
    const patch = { title: 'New title' };
    const result = decideVideoMetadataUpdate({
      editor: OWNER,
      video,
      videoId: video.id,
      patch,
    });

    expect(isOk(result) && result.value).toBe(patch);
  });

  it('reports an absent row as VIDEO_NOT_FOUND before checking the patch', () => {
    const result = decideVideoMetadataUpdate({
      editor: OWNER,
      video: null,
      videoId: 'gone',
      patch: { title: '' },
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('refuses an editor who does not own the video', () => {
    const result = decideVideoMetadataUpdate({
      editor: STRANGER,
      video,
      videoId: video.id,
      patch: { title: 'Hijack' },
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('composes the shared input rule, so an over-long title fails here too', () => {
    const result = decideVideoMetadataUpdate({
      editor: OWNER,
      video,
      videoId: video.id,
      patch: { title: 'a'.repeat(300) },
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
