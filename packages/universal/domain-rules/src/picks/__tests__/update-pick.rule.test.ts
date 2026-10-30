import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, PICK_NOW, STRANGER, aPick, aVideo } from '../../__tests__/entities';
import { type UpdatePickInput, decidePickUpdate } from '../update-pick.rule';

const pick = aPick();
const base: UpdatePickInput = {
  actor: ADMIN,
  pick,
  pickId: pick.id,
  patch: {},
  video: aVideo(),
  now: PICK_NOW,
  overlapping: null,
};

describe('@vp/domain-rules: decidePickUpdate', () => {
  it('keeps every omitted field, so an empty patch changes nothing', () => {
    expect(expectOk(decidePickUpdate(base))).toEqual(pick);
  });

  it.each([
    { name: 'the note', patch: { note: '  New line ' }, expected: { note: 'New line' } },
    { name: 'clearing the note', patch: { note: null }, expected: { note: null } },
    { name: 'the video', patch: { videoId: 'video-2' }, expected: { videoId: 'video-2' } },
    {
      name: 'the end of a running window',
      patch: { endsAt: new Date('2026-03-05T00:00:00Z') },
      expected: { endsAt: new Date('2026-03-05T00:00:00Z') },
    },
  ])('patches $name', ({ patch, expected }) => {
    expect(expectOk(decidePickUpdate({ ...base, patch }))).toEqual({ ...pick, ...expected });
  });

  it.each([
    { name: 'an anonymous caller', input: { actor: null }, code: ErrorCodes.UNAUTHORIZED },
    {
      name: 'a caller without the ability',
      input: { actor: STRANGER },
      code: ErrorCodes.FORBIDDEN,
    },
    { name: 'an absent pick', input: { pick: null }, code: ErrorCodes.PICK_NOT_FOUND },
    {
      name: 'a video that is not public',
      input: { video: aVideo({ visibility: 'private' }) },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'an end before the start',
      input: { patch: { endsAt: new Date('2026-03-01T09:00:00Z') } },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'an overlapping window',
      input: { overlapping: aPick({ id: 'pick-2' }) },
      code: ErrorCodes.PICK_WINDOW_OVERLAP,
    },
    {
      name: 'an over-long note',
      input: { patch: { note: 'a'.repeat(281) } },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $name with $code', ({ input, code }) => {
    expect(expectErr(decidePickUpdate({ ...base, ...input })).code).toBe(code);
  });
});
