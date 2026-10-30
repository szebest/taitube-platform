import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, PICK_NOW, STRANGER, aPick, aVideo } from '../../__tests__/entities';
import { type CreatePickInput, decidePickCreate } from '../create-pick.rule';

const base: CreatePickInput = {
  actor: ADMIN,
  video: aVideo(),
  videoId: 'video-1',
  startsAt: new Date('2026-03-02T00:00:00Z'),
  endsAt: new Date('2026-03-03T00:00:00Z'),
  note: '  Worth the ten minutes ',
  now: PICK_NOW,
  overlapping: null,
};

describe('@vp/domain-rules: decidePickCreate', () => {
  it('accepts a window, a public ready video and a note, tidying the note and stamping the admin', () => {
    expect(expectOk(decidePickCreate(base))).toEqual({
      pick: {
        videoId: 'video-1',
        startsAt: base.startsAt,
        endsAt: base.endsAt,
        note: 'Worth the ten minutes',
        createdBy: ADMIN.id,
      },
      video: base.video,
    });
  });

  it('accepts a pick without a note', () => {
    expect(expectOk(decidePickCreate({ ...base, note: undefined })).pick.note).toBeNull();
  });

  it.each([
    { name: 'an anonymous caller', input: { actor: null }, code: ErrorCodes.UNAUTHORIZED },
    {
      name: 'a caller without the ability',
      input: { actor: STRANGER },
      code: ErrorCodes.FORBIDDEN,
    },
    { name: 'an absent video', input: { video: null }, code: ErrorCodes.VIDEO_NOT_FOUND },
    {
      name: 'a private video',
      input: { video: aVideo({ visibility: 'private' }) },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'a window in the past',
      input: {
        startsAt: new Date('2026-02-01T00:00:00Z'),
        endsAt: new Date('2026-02-02T00:00:00Z'),
      },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'an overlapping window',
      input: { overlapping: aPick() },
      code: ErrorCodes.PICK_WINDOW_OVERLAP,
    },
    {
      name: 'an over-long note',
      input: { note: 'a'.repeat(281) },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $name with $code', ({ input, code }) => {
    expect(expectErr(decidePickCreate({ ...base, ...input })).code).toBe(code);
  });

  it('checks the caller first, so a stranger learns nothing about the video', () => {
    expect(expectErr(decidePickCreate({ ...base, actor: STRANGER, video: null })).code).toBe(
      ErrorCodes.FORBIDDEN
    );
  });
});
