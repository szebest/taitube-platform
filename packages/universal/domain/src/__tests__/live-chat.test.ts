import { liveChatOffsetMs } from '../live-chat';

describe('@vp/domain: live chat offset', () => {
  it.each([
    { scenario: 'after the start', at: 1_500, offset: 1_500 },
    { scenario: 'at the start', at: 0, offset: 0 },
    { scenario: 'on a clock behind the start', at: -200, offset: 0 },
  ])('files a line sent $scenario at $offset ms', ({ at, offset }) => {
    const startedAt = new Date('2026-11-05T12:00:00.000Z');

    expect(liveChatOffsetMs(startedAt, new Date(startedAt.getTime() + at))).toBe(offset);
  });
});
