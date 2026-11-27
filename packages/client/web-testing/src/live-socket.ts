import type { LiveChatServerFrame, WatchPartyServerFrame } from '@vp/api-contracts';
import { ws } from 'msw/ws';
import { LOCAL_API_BASE_URL } from './local-api';

interface ChatSocketOptions {
  canSend?: boolean;
  canModerate?: boolean;
}

/**
 * The chat socket of any stream at the local API: it says hello, then sends `lines`. What the page
 * sends lands in `received`, and every socket it opened in `urls`.
 */
export function mockLiveChatSocket(
  lines: readonly LiveChatServerFrame[],
  { canSend = false, canModerate = false }: ChatSocketOptions = {}
) {
  const received: unknown[] = [];
  const urls: string[] = [];
  const chat = ws.link(`${LOCAL_API_BASE_URL.replace('http', 'ws')}/v1/live/*/chat`);
  const handler = chat.addEventListener('connection', ({ client }) => {
    const hello: LiveChatServerFrame = {
      type: 'hello',
      resume: 'fresh',
      mode: { slowModeSeconds: 0, subscribersOnly: false },
      canSend,
      canModerate,
    };
    urls.push(client.url.toString());
    client.addEventListener('message', ({ data }) => {
      received.push(JSON.parse(String(data)));
    });
    for (const frame of [hello, ...lines]) {
      client.send(JSON.stringify(frame));
    }
  });
  return { handler, received, urls };
}

/**
 * The room socket of any watch party at the local API: it sends `opening` frames (the `hello` first)
 * on every connection, answers `clock` pings with the server's time, and keeps what the page sends in
 * `received`. `push` writes a frame to every open socket, `drop` closes them.
 */
export function mockWatchPartySocket(opening: readonly WatchPartyServerFrame[], serverNow = 0) {
  const received: unknown[] = [];
  const urls: string[] = [];
  const clients = new Set<{ send(data: string): void; close(): void }>();
  const room = ws.link(`${LOCAL_API_BASE_URL.replace('http', 'ws')}/v1/watch-parties/*/socket`);
  const handler = room.addEventListener('connection', ({ client }) => {
    urls.push(client.url.toString());
    clients.add(client);
    client.addEventListener('message', ({ data }) => {
      const frame = JSON.parse(String(data));
      received.push(frame);
      if (frame.type === 'clock') {
        client.send(JSON.stringify({ type: 'clock', t0: frame.t0, serverNow }));
      }
    });
    for (const frame of opening) {
      client.send(JSON.stringify(frame));
    }
  });
  return {
    handler,
    received,
    urls,
    push(frame: WatchPartyServerFrame) {
      for (const client of clients) {
        client.send(JSON.stringify(frame));
      }
    },
    drop() {
      for (const client of clients) {
        client.close();
      }
      clients.clear();
    },
  };
}

type Listener = (event: MessageEvent<string>) => void;

/**
 * jsdom has no `EventSource`: this one hears nothing until the spec `emit`s a frame, and records the
 * URL of every source the page opened.
 */
export function stubEventSource() {
  const listeners = new Map<string, Listener[]>();
  const urls: string[] = [];

  class FakeEventSource {
    constructor(url: string) {
      urls.push(url);
    }

    addEventListener(name: string, listener: Listener) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    }

    close() {
      listeners.clear();
    }
  }
  vi.stubGlobal('EventSource', FakeEventSource);

  return {
    urls,
    emit(name: string, data: unknown) {
      for (const listener of listeners.get(name) ?? []) {
        listener(new MessageEvent(name, { data: JSON.stringify(data) }));
      }
    },
  };
}
