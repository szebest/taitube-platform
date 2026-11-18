import {
  DAY,
  HOUR,
  MILLISECONDS_PER_SECOND,
  MINUTE,
  MONTH,
  SECOND,
  WEEK,
  YEAR,
} from '../time-spans';

describe('@vp/intl: time spans', () => {
  it.each([
    { span: 'SECOND', seconds: SECOND, expected: 1 },
    { span: 'MINUTE', seconds: MINUTE, expected: 60 },
    { span: 'HOUR', seconds: HOUR, expected: 3_600 },
    { span: 'DAY', seconds: DAY, expected: 86_400 },
    { span: 'WEEK', seconds: WEEK, expected: 604_800 },
    { span: 'MONTH', seconds: MONTH, expected: 2_592_000 },
    { span: 'YEAR', seconds: YEAR, expected: 31_536_000 },
  ])('holds $span as $expected seconds', ({ seconds, expected }) => {
    expect(seconds).toBe(expected);
  });

  it('counts a thousand milliseconds to the second', () => {
    expect(MILLISECONDS_PER_SECOND).toBe(1000);
  });
});
