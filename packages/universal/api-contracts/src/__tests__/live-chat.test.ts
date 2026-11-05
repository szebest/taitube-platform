import {
  createLiveChatTicket,
  getLiveChatReplay,
  LiveChatClientFrameSchema,
  liveChatSocket,
} from '../live-chat';

describe('packages/api-contracts: live chat', () => {
  it.each([
    {
      endpoint: createLiveChatTicket,
      method: 'POST',
      path: '/v1/live/:id/chat/ticket',
      status: 201,
    },
    { endpoint: liveChatSocket, method: 'GET', path: '/v1/live/:id/chat', status: 101 },
    { endpoint: getLiveChatReplay, method: 'GET', path: '/v1/live/:id/chat/replay', status: 200 },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it.each([
    { scenario: 'a window', query: { fromMs: '0', toMs: '5000' }, ok: true },
    { scenario: 'an empty window', query: { fromMs: '5000', toMs: '5000' }, ok: false },
    { scenario: 'a negative start', query: { fromMs: '-1', toMs: '5000' }, ok: false },
  ])('takes a replay of $scenario: $ok', ({ query, ok }) => {
    expect(getLiveChatReplay.query.safeParse(query).success).toBe(ok);
  });

  it.each([
    { scenario: 'a line with a ref', frame: { type: 'send', ref: 'r1', message: 'gg' }, ok: true },
    {
      scenario: 'a removal',
      frame: { type: 'remove', id: '00000000-0000-7000-8000-0000000000e1' },
      ok: true,
    },
    { scenario: 'an unknown frame', frame: { type: 'ban', id: 'x' }, ok: false },
  ])('reads a chat frame of $scenario: $ok', ({ frame, ok }) => {
    expect(LiveChatClientFrameSchema.safeParse(frame).success).toBe(ok);
  });
});
