import {
  buildPath,
  type WatchPartyClientFrame,
  type WatchPartyServerFrame,
  watchPartySocket,
} from '@vp/api-contracts';
import { clockOffsetMs, type ClockSample } from '@vp/domain';
import { fromPromise, isOk, parseJson } from '@vp/result';
import { useEffect, useReducer, useRef } from 'react';
import { useApi } from './api-provider';
import { INITIAL_WATCH_PARTY, type WatchPartyState, watchPartyReducer } from './watch-party-state';

const FIRST_RETRY_MS = 1_000;
const LAST_RETRY_MS = 30_000;
const CLOCK_PING_MS = 30_000;
const CLOCK_SAMPLES_KEPT = 8;

export interface WatchPartySocketOptions {
  roomId: string;
  /** The API's public origin: the socket goes there, since the app's `/api` proxy carries no upgrade. */
  apiUrl: string;
  enabled?: boolean;
}

export interface WatchPartySocket {
  state: WatchPartyState;
  /** The room's server clock now, from the lowest round trip of the latest clock samples. */
  serverNow: () => number;
  send: (frame: WatchPartyClientFrame) => boolean;
  dismissRequest: (key: string) => void;
}

function readFrame(data: unknown): WatchPartyServerFrame | undefined {
  const json = typeof data === 'string' ? parseJson(data) : undefined;
  const parsed = json && isOk(json) ? watchPartySocket.result.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data : undefined;
}

function socketUrl(apiUrl: string, roomId: string, ticket: string, after?: string): string {
  const url = new URL(buildPath(watchPartySocket.path, { id: roomId }), apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('ticket', ticket);
  if (after) {
    url.searchParams.set('after', after);
  }
  return url.toString();
}

/**
 * One room's socket for a member, whatever their kind: a one-time pass, `hello` as the full
 * snapshot, frames folded into `state`, a clock ping every 30 s. A dropped socket retries with
 * backoff and resumes chat after the last line; a member the room ended (kicked, closed, superseded)
 * is not retried.
 */
export function useWatchPartySocket({
  roomId,
  apiUrl,
  enabled = true,
}: WatchPartySocketOptions): WatchPartySocket {
  const [state, dispatch] = useReducer(watchPartyReducer, INITIAL_WATCH_PARTY);
  const socket = useRef<WebSocket | null>(null);
  const samples = useRef<ClockSample[]>([]);

  const api = useApi();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const stopped = new AbortController();
    const connection: {
      lastLineId?: string;
      retries: number;
      ended: boolean;
      retryTimer?: ReturnType<typeof setTimeout>;
      pingTimer?: ReturnType<typeof setInterval>;
    } = { retries: 0, ended: false };

    const retryLater = () => {
      dispatch({ type: 'connection', connection: 'closed' });
      if (connection.ended) {
        return;
      }
      connection.retryTimer = setTimeout(
        open,
        Math.min(FIRST_RETRY_MS * 2 ** connection.retries, LAST_RETRY_MS)
      );
      connection.retries += 1;
    };

    const ping = (opened: WebSocket) => {
      if (opened.readyState === WebSocket.OPEN) {
        opened.send(JSON.stringify({ type: 'clock', t0: Date.now() }));
      }
    };

    const open = async () => {
      dispatch({ type: 'connection', connection: 'connecting' });
      const issued = await fromPromise(
        () => api.watchPartySocket.createWatchPartySocketTicket({ params: { id: roomId } }),
        (cause) => cause
      );
      if (stopped.signal.aborted) {
        return;
      }
      if (!isOk(issued)) {
        retryLater();
        return;
      }

      const opened = new WebSocket(
        socketUrl(apiUrl, roomId, issued.value.ticket, connection.lastLineId)
      );
      opened.addEventListener('open', () => {
        connection.retries = 0;
        ping(opened);
        connection.pingTimer = setInterval(() => ping(opened), CLOCK_PING_MS);
      });
      opened.addEventListener('message', ({ data }) => {
        const frame = readFrame(data);
        if (!frame) {
          return;
        }
        if (frame.type === 'clock') {
          samples.current = [
            ...samples.current,
            { t0: frame.t0, serverNow: frame.serverNow, t1: Date.now() },
          ].slice(-CLOCK_SAMPLES_KEPT);
        }
        if (frame.type === 'chat.message') {
          connection.lastLineId = frame.message.id;
        }
        if (frame.type === 'kicked' || frame.type === 'closed' || frame.type === 'superseded') {
          connection.ended = true;
        }
        dispatch({ type: 'frame', frame });
      });
      opened.addEventListener('close', () => {
        clearInterval(connection.pingTimer);
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
      clearTimeout(connection.retryTimer);
      clearInterval(connection.pingTimer);
      socket.current?.close();
      socket.current = null;
      samples.current = [];
    };
  }, [api, apiUrl, roomId, enabled]);

  return {
    state,
    serverNow: () => Date.now() + (clockOffsetMs(samples.current) ?? 0),
    send: (frame) => {
      const open = socket.current;
      if (open?.readyState !== WebSocket.OPEN) {
        return false;
      }

      open.send(JSON.stringify(frame));
      return true;
    },
    dismissRequest: (key) => dispatch({ type: 'dismissRequest', key }),
  };
}
