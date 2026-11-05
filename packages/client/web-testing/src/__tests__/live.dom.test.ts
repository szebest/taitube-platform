import { apiServer } from '../api-server';
import { chatLine, mockLiveChatSocket, stubEventSource } from '../live';
import { LOCAL_API_BASE_URL } from '../local-api';

function openChat(lines = [chatLine(1, 'hello')]) {
  const socket = mockLiveChatSocket(lines, { canSend: true });
  apiServer.use(socket.handler);
  const opened = new WebSocket(`${LOCAL_API_BASE_URL.replace('http', 'ws')}/v1/live/s1/chat`);
  const frames: unknown[] = [];
  opened.addEventListener('message', ({ data }) => frames.push(JSON.parse(String(data))));
  return { socket, opened, frames };
}

describe('@vp/web-testing: the live helpers', () => {
  it('answers a chat socket with hello, then the lines, and keeps what the page sends', async () => {
    const { socket, opened, frames } = openChat();

    await vi.waitFor(() => expect(frames).toHaveLength(2));
    opened.send(JSON.stringify({ type: 'send', message: 'hi' }));

    expect(frames).toEqual([
      expect.objectContaining({ type: 'hello', canSend: true, canModerate: false }),
      chatLine(1, 'hello'),
    ]);
    await vi.waitFor(() => expect(socket.received).toEqual([{ type: 'send', message: 'hi' }]));
  });

  it('delivers a frame emitted on a stubbed event source to its listener', () => {
    const events = stubEventSource();
    const heard: string[] = [];
    const source = new EventSource('/api/v1/videos/v1/events');
    source.addEventListener('live.viewers', ({ data }) => heard.push(data));

    events.emit('live.viewers', { viewers: 3 });

    expect(heard).toEqual(['{"viewers":3}']);
    expect(events.urls).toEqual(['/api/v1/videos/v1/events']);
  });
});
