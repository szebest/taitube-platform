import { formatSseFrame, SSE_PING_COMMENT } from '../sse';

describe('formatSseFrame', () => {
  it.each([
    ['an empty frame', {}, '\n'],
    [
      'an id, an event and a string payload',
      { id: 7, event: 'status', data: 'raw' },
      'id: 7\nevent: status\ndata: raw\n\n',
    ],
    ['an object payload as JSON', { data: { a: 1 } }, 'data: {"a":1}\n\n'],
    ['a string id', { id: 'abc' }, 'id: abc\n\n'],
  ])('writes %s', (_label, options, frame) => {
    expect(formatSseFrame(options)).toBe(frame);
  });
});

describe('SSE_PING_COMMENT', () => {
  it('is a comment frame', () => {
    expect(SSE_PING_COMMENT).toBe(': ping\n\n');
  });
});
