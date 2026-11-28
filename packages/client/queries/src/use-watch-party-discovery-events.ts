import { isOk, parseJson } from '@kit/result';
import { onlineManager } from '@tanstack/react-query';
import {
  streamWatchPartyEvents,
  type WatchPartyDiscoveryEvent,
  WatchPartyDiscoveryEventSchema,
} from '@vp/api-contracts';
import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';
import { API_PROXY_PATH } from './api-client';

const EVENT_TYPES = WatchPartyDiscoveryEventSchema.options.map((option) => option.shape.type.value);

function readEvent(data: string): WatchPartyDiscoveryEvent | undefined {
  const json = parseJson(data);
  const parsed = isOk(json) ? WatchPartyDiscoveryEventSchema.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data : undefined;
}

function subscribeToVisibility(notify: () => void): () => void {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}

const isVisible = () => document.visibilityState === 'visible';

export interface PartyDiscoveryEvents {
  /** Whether the stream is open, which is while the page is visible and the browser online. */
  live: boolean;
}

/**
 * Listens to discovery's anonymous stream through the app's `/api` proxy, only while the page is
 * visible and the browser online. `live` is false while it is not open or the connection broke, so a
 * page can say its updates are paused.
 */
export function useWatchPartyDiscoveryEvents(
  onEvent: (event: WatchPartyDiscoveryEvent) => void,
  onStatus: (live: boolean) => void
): void {
  const visible = useSyncExternalStore(subscribeToVisibility, isVisible, () => false);
  const online = useSyncExternalStore(
    onlineManager.subscribe.bind(onlineManager),
    () => onlineManager.isOnline(),
    () => true
  );
  const deliver = useEffectEvent(onEvent);
  const report = useEffectEvent(onStatus);

  useEffect(() => {
    if (!visible || !online) {
      report(false);
      return;
    }

    const source = new EventSource(`${API_PROXY_PATH}${streamWatchPartyEvents.path}`);
    const onFrame = ({ data }: MessageEvent<string>) => {
      const event = readEvent(data);
      if (event) deliver(event);
    };
    for (const type of EVENT_TYPES) source.addEventListener(type, onFrame);
    source.addEventListener('open', () => report(true));
    source.addEventListener('error', () => report(false));

    return () => {
      source.close();
    };
  }, [visible, online]);
}
