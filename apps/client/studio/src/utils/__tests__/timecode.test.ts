import { formatTimecode, parseTimecode } from '../timecode';

describe('apps/client/studio: timecode', () => {
  it.each([
    { ms: 0, text: '0:00' },
    { ms: 5_000, text: '0:05' },
    { ms: 65_000, text: '1:05' },
    { ms: 3_725_000, text: '1:02:05' },
    { ms: 5_999, text: '0:05' },
  ])('writes $ms ms as $text', ({ ms, text }) => {
    expect(formatTimecode(ms)).toBe(text);
  });

  it.each([
    { text: '90', ms: 90_000 },
    { text: '1:30', ms: 90_000 },
    { text: ' 0:00 ', ms: 0 },
    { text: '1:02:05', ms: 3_725_000 },
    { text: '0:75', ms: null },
    { text: '1:75:00', ms: null },
    { text: '1:2:3:4', ms: null },
    { text: 'abc', ms: null },
    { text: '', ms: null },
    { text: '1.5', ms: null },
    { text: '-5', ms: null },
  ])('reads "$text" as $ms', ({ text, ms }) => {
    expect(parseTimecode(text)).toBe(ms);
  });

  it('reads back what it writes', () => {
    expect(parseTimecode(formatTimecode(3_725_000))).toBe(3_725_000);
  });
});
