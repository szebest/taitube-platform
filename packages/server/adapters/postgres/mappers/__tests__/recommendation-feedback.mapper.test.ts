import { toFeedback } from '../recommendation-feedback.mapper';

const createdAt = new Date('2026-03-01T12:00:00.000Z');

describe('postgres mapper: recommendation feedback', () => {
  it.each([
    {
      scenario: 'a video the viewer is not interested in',
      row: {
        id: 'f1',
        userId: 'u1',
        kind: 'not_interested',
        videoId: 'v1',
        channelId: null,
        createdAt,
      },
      expected: { id: 'f1', kind: 'not_interested', videoId: 'v1', createdAt },
    },
    {
      scenario: 'a hidden channel',
      row: {
        id: 'f2',
        userId: 'u1',
        kind: 'hide_channel',
        videoId: null,
        channelId: 'c1',
        createdAt,
      },
      expected: { id: 'f2', kind: 'hide_channel', channelId: 'c1', createdAt },
    },
  ] as const)('maps $scenario to the column of its kind', ({ row, expected }) => {
    expect(toFeedback(row)).toEqual(expected);
  });
});
