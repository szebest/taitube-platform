import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, MODERATOR, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import {
  DELETABLE_STATUSES,
  REPROCESSABLE_STATUSES,
  TAKEDOWN_STATUSES,
  decideVideoDelete,
  decideVideoReprocess,
  decideVideoTakedown,
} from '../lifecycle.rule';

const video = aVideo();

describe('@vp/domain-rules: decideVideoReprocess', () => {
  it.each(REPROCESSABLE_STATUSES.map((status) => ({ status })))(
    'lets the owner reprocess a video in $status',
    ({ status }) => {
      const subject = aVideo({ status });

      expect(
        isOk(decideVideoReprocess({ actor: OWNER, video: subject, videoId: subject.id }))
      ).toBe(true);
    }
  );

  it.each([{ status: 'UPLOADING' as const }, { status: 'DELETED' as const }])(
    'refuses a video in $status and names what it would have accepted',
    ({ status }) => {
      const result = decideVideoReprocess({
        actor: OWNER,
        video: aVideo({ status }),
        videoId: video.id,
      });

      expect(isErr(result) && result.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(isErr(result) && 'eligible' in result.error && result.error.eligible).toEqual(
        REPROCESSABLE_STATUSES
      );
    }
  );

  it.each([
    { name: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { name: 'someone who does not own it', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
  ])('refuses $name before looking at the status', ({ actor, code }) => {
    const result = decideVideoReprocess({
      actor,
      video: aVideo({ status: 'DELETED' }),
      videoId: video.id,
    });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it.each([
    { name: 'an admin', actor: ADMIN },
    { name: 'the owner', actor: OWNER },
    { name: 'a stranger', actor: STRANGER },
  ])('reports an absent video to $name as absent, not as forbidden', ({ actor }) => {
    const result = decideVideoReprocess({ actor, video: null, videoId: 'gone' });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('does not let an anonymous caller learn whether an id exists', () => {
    const result = decideVideoReprocess({ actor: null, video: null, videoId: 'gone' });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.UNAUTHORIZED);
  });
});

describe('@vp/domain-rules: decideVideoDelete', () => {
  it.each(DELETABLE_STATUSES.map((status) => ({ status })))(
    'lets the owner delete a video in $status',
    ({ status }) => {
      const subject = aVideo({ status });

      expect(isOk(decideVideoDelete({ actor: OWNER, video: subject, videoId: subject.id }))).toBe(
        true
      );
    }
  );

  it('refuses a video already deleted', () => {
    const result = decideVideoDelete({
      actor: OWNER,
      video: aVideo({ status: 'DELETED' }),
      videoId: video.id,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('lets an admin delete a video they do not own', () => {
    expect(isOk(decideVideoDelete({ actor: ADMIN, video, videoId: video.id }))).toBe(true);
  });
});

describe('@vp/domain-rules: decideVideoTakedown', () => {
  it.each(TAKEDOWN_STATUSES.map((status) => ({ status })))(
    'lets an admin take down a video in $status',
    ({ status }) => {
      const subject = aVideo({ status });

      expect(isOk(decideVideoTakedown({ actor: ADMIN, video: subject, videoId: subject.id }))).toBe(
        true
      );
    }
  );

  it.each([
    { name: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { name: 'the owner', actor: OWNER, code: ErrorCodes.FORBIDDEN },
    { name: 'a moderator', actor: MODERATOR, code: ErrorCodes.FORBIDDEN },
  ])('refuses $name', ({ actor, code }) => {
    const result = decideVideoTakedown({ actor, video, videoId: video.id });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('refuses a video already deleted, which has nothing left to take down', () => {
    const result = decideVideoTakedown({
      actor: ADMIN,
      video: aVideo({ status: 'DELETED' }),
      videoId: video.id,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
