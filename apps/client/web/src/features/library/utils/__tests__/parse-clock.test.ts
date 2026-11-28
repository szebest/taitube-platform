import { parseClock } from '../parse-clock';

describe('apps/client/web: parseClock', () => {
  it.each([
    ['90', 90_000],
    ['1:30', 90_000],
    [' 0:05 ', 5000],
    ['1:01:30', 3_690_000],
    ['75:00', 4_500_000],
    ['1:60', null],
    ['1:60:00', null],
    ['1:2:3:4', null],
    ['1:3a', null],
    ['', null],
    ['-5', null],
  ])('reads %j as %s', (text, ms) => {
    expect(parseClock(text)).toBe(ms);
  });
});
