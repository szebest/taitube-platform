import { SseMessageEnvelope } from '../envelope';

describe('SseMessageEnvelope', () => {
  it.each([
    ['a known event', { event: 'progress', data: {} }, true],
    ['an unknown event', { event: 'nope', data: {} }, false],
    ['a fractional id', { event: 'status', data: {}, id: 1.5 }, false],
  ])('parses %s', (_label, input, success) => {
    expect(SseMessageEnvelope.safeParse(input).success).toBe(success);
  });
});
