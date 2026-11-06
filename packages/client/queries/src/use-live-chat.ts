import { buildPath, type LiveChatServerFrame, liveChatSocket } from '@vp/api-contracts';
import { fromPromise, isOk, parseJson } from '@vp/result';
import { useEffect, useReducer, useRef } from 'react';

import { useApi } from './api-provider';
import {
  INITIAL_LIVE_CHAT,
  type LiveChatLine,
  type LiveChatState,
  liveChatReducer,
} from './live-chat-state';
import { useAccount } from './session-provider';

const FIRST_RETRY_MS = 1_000;
const LAST_RETRY_MS = 30_000;

export interface LiveChatOptions {
  liveStreamId: string;
  /** The API's public origin: the socket goes there, since the app's `/api` proxy carries no upgrade. */
  apiUrl: string;
  /** False keeps the socket closed, as for a broadcast that ended. */
  enabled?: boolean;
}

export interface LiveChat extends LiveChatState {
  send: (text: string) => void;
  retry: (line: LiveChatLine) => void;
  remove: (id: string) => void;
}

function readFrame(data: unknown): LiveChatServerFrame | undefined {
  const json = typeof data === 'string' ? parseJson(data) : undefined;
  const parsed = json && isOk(json) ? liveChatSocket.result.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data : undefined;
}

function socketUrl(apiUrl: string, liveStreamId: string, ticket?: string, after?: string): string {
  const url = new URL(buildPath(liveChatSocket.path, { id: liveStreamId }), apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  if (ticket) url.searchParams.set('ticket', ticket);
  if (after) url.searchParams.set('after', after);
  return url.toString();
}

/**
 * A broadcast's chat over its socket: a signed-in viewer opens it with a one-time pass from
 * `createLiveChatTicket` and may send, a guest only reads. A dropped socket, or a pass the API did
 * not issue, retries with backoff while the state says `closed`; the socket resumes after the last
 * line it had, and the viewer's lines still on their way come back failed, with Retry.
 */
export function useLiveChat({ liveStreamId, apiUrl, enabled = true }: LiveChatOptions): LiveChat {
  const [state, dispatch] = useReducer(liveChatReducer, INITIAL_LIVE_CHAT);
  const socket = useRef<WebSocket | null>(null);

  const api = useApi();
  const self = useAccount()?.id;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const stopped = new AbortController();
    let lastId: string | undefined;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const retryLater = () => {
      dispatch({ type: 'connection', connection: 'closed' });
      retryTimer = setTimeout(open, Math.min(FIRST_RETRY_MS * 2 ** retries, LAST_RETRY_MS));
      retries += 1;
    };

    const issueTicket = () =>
      fromPromise(
        () => api.liveChat.createLiveChatTicket({ params: { id: liveStreamId } }),
        (cause) => cause
      );

    const open = async () => {
      dispatch({ type: 'connection', connection: 'connecting' });
      const issued = self === undefined ? undefined : await issueTicket();
      if (stopped.signal.aborted) {
        return;
      }
      if (issued && !isOk(issued)) {
        retryLater();
        return;
      }

      const ticket = issued && isOk(issued) ? issued.value.ticket : undefined;
      const opened = new WebSocket(socketUrl(apiUrl, liveStreamId, ticket, lastId));
      opened.addEventListener('open', () => {
        retries = 0;
      });
      opened.addEventListener('message', ({ data }) => {
        const frame = readFrame(data);
        if (!frame) {
          return;
        }
        if (frame.type === 'message') {
          lastId = frame.message.id;
        }
        dispatch({ type: 'frame', frame, self });
      });
      opened.addEventListener('close', () => {
        if (stopped.signal.aborted) {
          return;
        }
        retryLater();
      });
      socket.current = opened;
    };

    void open();

    return () => {
      stopped.abort();
      clearTimeout(retryTimer);
      socket.current?.close();
      socket.current = null;
    };
  }, [api, apiUrl, liveStreamId, enabled, self]);

  const sendFrame = (frame: object): boolean => {
    const open = socket.current;
    if (open?.readyState !== WebSocket.OPEN) {
      return false;
    }

    open.send(JSON.stringify(frame));
    return true;
  };

  const sendLine = (ref: string, text: string) => {
    dispatch({ type: 'sending', ref, text });
    if (!sendFrame({ type: 'send', ref, message: text })) {
      dispatch({ type: 'unsent', ref });
    }
  };

  return {
    ...state,
    send: (text) => sendLine(crypto.randomUUID(), text),
    retry: (line) => sendLine(line.key, line.text),
    remove: (id) => {
      sendFrame({ type: 'remove', id });
    },
  };
}
