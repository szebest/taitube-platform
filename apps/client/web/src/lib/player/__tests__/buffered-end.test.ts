import { bufferedEndAt } from '../buffered-end';

describe('bufferedEndAt', () => {
  it.each([
    { label: 'nothing buffered', buffered: [], time: 5, end: 0 },
    { label: 'the playhead inside a range', buffered: [[0, 30]], time: 12, end: 30 },
    { label: 'the playhead at the start of a range', buffered: [[10, 20]], time: 10, end: 20 },
    { label: 'the playhead after a seek into a gap', buffered: [[0, 8]], time: 20, end: 0 },
    {
      label: 'the playhead in the second of two ranges',
      buffered: [
        [0, 8],
        [40, 70],
      ],
      time: 45,
      end: 70,
    },
  ] as const)('is $end for $label', ({ buffered, time, end }) => {
    expect(bufferedEndAt(buffered, time)).toBe(end);
  });
});
