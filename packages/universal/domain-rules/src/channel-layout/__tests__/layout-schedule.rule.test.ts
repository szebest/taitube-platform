import { expectErr, expectOk } from '@kit/testing/result';
import { decideLayoutSchedule } from '../layout-schedule.rule';

const now = new Date('2026-12-01T10:00:00Z');

describe('@vp/domain-rules: decideLayoutSchedule', () => {
  it('accepts a time after now', () => {
    const publishAt = new Date('2026-12-01T10:00:01Z');

    expect(expectOk(decideLayoutSchedule({ publishAt, now }))).toBe(publishAt);
  });

  it.each([
    { scenario: 'now', publishAt: now },
    { scenario: 'the past', publishAt: new Date('2026-11-30T10:00:00Z') },
  ])('refuses $scenario', ({ publishAt }) => {
    expect(expectErr(decideLayoutSchedule({ publishAt, now }))).toMatchObject({
      code: 'LAYOUT_SCHEDULE_INVALID',
    });
  });
});
