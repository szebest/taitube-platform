import {
  buildPath,
  type LiveStreamPublicView,
  LiveVideoEventSchemas,
  streamVideoEvents,
} from '@vp/api-contracts';
import { isOk, parseJson } from '@vp/result';
import { useEffect, useState } from 'react';
import type { z } from 'zod';

import { API_PROXY_PATH } from './api-client';

export interface ViewerSample {
  /** Epoch milliseconds the count arrived at. */
  at: number;
  viewers: number;
}

export interface LiveVideoEvents {
  viewers: number | null;
  status: LiveStreamPublicView['status'] | null;
  /** The counts heard since the page opened, oldest first. */
  samples: readonly ViewerSample[];
}

/** The most samples kept: an hour at the API's 15 s heartbeat. */
const VIEWER_SAMPLES_KEPT = 240;

const NOTHING_HEARD: LiveVideoEvents = { viewers: null, status: null, samples: [] };

function readData<Data>(schema: z.ZodType<Data>, data: string): Data | undefined {
  const json = parseJson(data);
  const parsed = isOk(json) ? schema.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data : undefined;
}

function withViewers(heard: LiveVideoEvents, viewers: number): LiveVideoEvents {
  const samples = [...heard.samples, { at: Date.now(), viewers }].slice(-VIEWER_SAMPLES_KEPT);
  return { ...heard, viewers, samples };
}

/**
 * A broadcast's viewer count and status, from its video's event stream through the app's `/api`
 * proxy. `null` until the stream says, and while there is no video to listen to. Key the caller
 * by the video, so a new one starts from nothing heard.
 */
export function useLiveVideoEvents(videoId: string | null): LiveVideoEvents {
  const [heard, setHeard] = useState(NOTHING_HEARD);

  useEffect(() => {
    if (videoId === null) {
      return;
    }

    const source = new EventSource(
      `${API_PROXY_PATH}${buildPath(streamVideoEvents.path, { id: videoId })}`
    );
    const onSnapshot = ({ data }: MessageEvent<string>) => {
      const live = readData(LiveVideoEventSchemas['snapshot'], data)?.live;
      if (live) {
        setHeard((current) => ({ ...withViewers(current, live.viewers), status: live.status }));
      }
    };
    const onViewers = ({ data }: MessageEvent<string>) => {
      const frame = readData(LiveVideoEventSchemas['live.viewers'], data);
      if (frame) {
        setHeard((current) => withViewers(current, frame.viewers));
      }
    };
    const onStatus = ({ data }: MessageEvent<string>) => {
      const frame = readData(LiveVideoEventSchemas['live.status'], data);
      if (frame) {
        setHeard((current) => ({ ...current, status: frame.status }));
      }
    };
    source.addEventListener('snapshot', onSnapshot);
    source.addEventListener('live.viewers', onViewers);
    source.addEventListener('live.status', onStatus);

    return () => {
      source.close();
    };
  }, [videoId]);

  return heard;
}
