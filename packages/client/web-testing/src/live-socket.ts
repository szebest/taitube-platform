import type { LiveChatServerFrame } from '@vp/api-contracts';
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
