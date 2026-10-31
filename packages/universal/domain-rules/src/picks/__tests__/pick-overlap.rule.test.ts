import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { aPick } from '../../__tests__/entities';
import { decidePickNoOverlap } from '../pick-overlap.rule';

const window = {
  startsAt: new Date('2026-03-02T00:00:00Z'),
  endsAt: new Date('2026-03-03T00:00:00Z'),
};

describe('@vp/domain-rules: decidePickNoOverlap', () => {
  it('accepts a window nobody else holds', () => {
    expect(expectOk(decidePickNoOverlap(window, null))).toBe(window);
  });

  it('refuses a window another pick holds, naming the window', () => {
    expect(expectErr(decidePickNoOverlap(window, aPick()))).toMatchObject({
      code: ErrorCodes.PICK_WINDOW_OVERLAP,
      startsAt: '2026-03-02T00:00:00.000Z',
      endsAt: '2026-03-03T00:00:00.000Z',
    });
  });
});
