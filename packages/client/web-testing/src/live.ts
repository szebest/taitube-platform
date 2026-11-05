import type { LiveChatMessageView, LiveChatServerFrame } from '@vp/api-contracts';
import { ws } from 'msw/ws';

import { LOCAL_API_BASE_URL } from './local-api';

const AUTHOR_ID = '0190c3a0-5e1d-7000-8000-00000000e0a1';
const MESSAGE_ID_PREFIX = '0190c3a0-5e1d-7000-8000-00000000f';

export const chatMessageId = (index: number) =>
  `${MESSAGE_ID_PREFIX}${String(index).padStart(3, '0')}`;

/** Chat line `index`, posted `index` seconds into the broadcast. */
export function chatMessage(
  index: number,
  message: string,
  displayName: string | null = 'Mira'
): LiveChatMessageView {
  return {
    id: chatMessageId(index),
    author: { userId: AUTHOR_ID, handle: 'mira', displayName, avatarUrl: null },
    message,
    offsetMs: index * 1000,
    createdAt: '2026-11-05T10:00:00.000Z',
  };
}

export const chatLine = (
  index: number,
  message: string,
  displayName?: string | null
): LiveChatServerFrame => ({
  type: 'message',
  message: chatMessage(index, message, displayName),
});

export const chatRemoved = (index: number): LiveChatServerFrame => ({
  type: 'removed',
  id: chatMessageId(index),
});

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
