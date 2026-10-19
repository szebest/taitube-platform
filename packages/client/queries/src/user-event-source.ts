import { onlineManager } from '@tanstack/react-query';
import { type ContractResult, streamMyEvents } from '@vp/api-contracts';
import { fromPromise, ignore, isOk, parseJson } from '@vp/result';

import { API_PROXY_PATH } from './api-client';

export type UserStreamEvent = ContractResult<typeof streamMyEvents>;

interface UserEventSource {
  readonly readyState: number;
  readonly CLOSED: number;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export interface UserEventBrowser {
  locks: {
    request(name: string, options: LockOptions, lead: () => Promise<void>): Promise<unknown>;
  };
  openChannel: (name: string) => BroadcastChannel;
  openSource: (url: string) => UserEventSource;
}

export interface UserEventConnection {
  name: string;
  browser: UserEventBrowser;
  onEvent: (event: UserStreamEvent) => void;
}

interface Delivery {
  id?: number;
  event: UserStreamEvent;
}

const USER_EVENTS_URL = `${API_PROXY_PATH}${streamMyEvents.path}`;
const EVENT_TYPES = streamMyEvents.result.options.map((option) => option.shape.type.value);
const FIRST_RETRY_MS = 1_000;
const LAST_RETRY_MS = 30_000;

function readEvent(data: string): UserStreamEvent | undefined {
  const json = parseJson(data);
  const parsed = isOk(json) ? streamMyEvents.result.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data : undefined;
}

export function connectUserEvents({ name, browser, onEvent }: UserEventConnection): () => void {
  const channel = browser.openChannel(name);
  const stopped = new AbortController();
  let lastSeenId = 0;

  const deliver = ({ id, event }: Delivery) => {
    if (id !== undefined && id <= lastSeenId) return;
    if (id !== undefined) lastSeenId = id;
    onEvent(event);
  };

  const onBroadcast = (message: MessageEvent<Delivery>) => {
    deliver(message.data);
  };
  channel.addEventListener('message', onBroadcast);

  const lead = () =>
    new Promise<void>((release) => {
      if (stopped.signal.aborted) {
        release();
        return;
      }

      let source: UserEventSource | undefined;
      let sourceLastId = '';
      let retries = 0;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;

      const onFrame = (frame: MessageEvent<string>) => {
        // EventSource repeats the last id on a frame that carries none, such as a progress tick.
        const carriesId = frame.lastEventId !== sourceLastId;
        sourceLastId = frame.lastEventId;
        const event = readEvent(frame.data);
        if (!event) return;

        const delivery = carriesId ? { id: Number(frame.lastEventId), event } : { event };
        channel.postMessage(delivery);
        deliver(delivery);
      };

      const close = () => {
        clearTimeout(retryTimer);
        source?.close();
        source = undefined;
      };

      const retryLater = () => {
        retryTimer = setTimeout(open, Math.min(FIRST_RETRY_MS * 2 ** retries, LAST_RETRY_MS));
        retries += 1;
      };

      const open = () => {
        close();
        if (!onlineManager.isOnline()) return;

        const opened = browser.openSource(
          lastSeenId > 0 ? `${USER_EVENTS_URL}?last-event-id=${lastSeenId}` : USER_EVENTS_URL
        );
        sourceLastId = '';
        for (const type of EVENT_TYPES) opened.addEventListener(type, onFrame);
        opened.addEventListener('open', () => {
          retries = 0;
        });
        opened.addEventListener('error', () => {
          if (opened.readyState !== opened.CLOSED || opened !== source) return;

          retryLater();
        });
        source = opened;
      };

      const unsubscribeOnline = onlineManager.subscribe(open);
      open();

      stopped.signal.addEventListener('abort', () => {
        unsubscribeOnline();
        close();
        release();
      });
    });

  ignore(
    fromPromise(
      () => browser.locks.request(name, { signal: stopped.signal }, lead),
      (cause) => cause
    ),
    'a tab that closes before its turn to lead aborts its lock request'
  );

  return () => {
    stopped.abort();
    channel.removeEventListener('message', onBroadcast);
    channel.close();
  };
}
