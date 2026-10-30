import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
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

describe('@vp/domain-rules: decideVideoMetadataUpdate over studio fields', () => {
  it('hands back the patch with its tags as the tag rule normalized them', () => {
    const result = decideVideoMetadataUpdate({
      editor: OWNER,
      video,
      videoId: video.id,
      patch: { tags: ['LoFi ', 'lofi'], categoryId: 'category-1' },
    });

    expect(isOk(result) && result.value).toEqual({ tags: ['LoFi'], categoryId: 'category-1' });
  });

  it('rejects more tags than the ceiling as a validation failure on tags', () => {
    const result = decideVideoMetadataUpdate({
      editor: OWNER,
      video,
      videoId: video.id,
      patch: { tags: Array.from({ length: 31 }, (_, i) => `tag-${i}`) },
    });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'tags',
    });
  });

  it('treats a deleted video as gone, even to its owner', () => {
    const deleted = aVideo({ status: 'DELETED' });
    const result = decideVideoMetadataUpdate({
      editor: OWNER,
      video: deleted,
      videoId: deleted.id,
      patch: { title: 'Back' },
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it.each([
    { name: 'the owner', editor: OWNER, allowed: false },
    { name: 'an admin', editor: ADMIN, allowed: true },
  ])('lets $name reopen a video taken down: $allowed', ({ editor, allowed }) => {
    const takenDown = aVideo({ status: 'REJECTED', visibility: 'private' });
    const result = decideVideoMetadataUpdate({
      editor,
      video: takenDown,
      videoId: takenDown.id,
      patch: { visibility: 'public' },
    });

    expect(isOk(result)).toBe(allowed);
  });
});

describe('@vp/domain-rules: decideVideoMetadataUpdate — which forbidden it is', () => {
  it.each([
    {
      name: 'a private video the editor cannot even see',
      visibility: 'private' as const,
      readable: false,
    },
    {
      name: 'an unlisted video the editor can see but not edit',
      visibility: 'unlisted' as const,
      readable: true,
    },
  ])(
    'marks $name as readable=$readable, so the edge knows whether to disguise it',
    ({ visibility, readable }) => {
      const video = aVideo({ visibility });
      const result = decideVideoMetadataUpdate({
        editor: STRANGER,
        video,
        videoId: video.id,
        patch: { title: 'Hack' },
      });

      expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
      expect(isErr(result) && 'readable' in result.error && result.error.readable).toBe(readable);
    }
  );
});
