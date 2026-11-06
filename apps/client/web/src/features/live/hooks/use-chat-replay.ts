import { useQueries } from '@tanstack/react-query';
import type { LiveChatMessageView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { usePlayerTime } from '#app/features/player';
import { chatReplayQueryOptions, REPLAY_WINDOW_MS } from '../api/live-queries';

const MS_PER_SECOND = 1000;

/** The most lines shown: the latest ones posted before the playhead. */
const REPLAY_LINES_SHOWN = 100;

/**
 * The chat lines posted up to where the recording plays now, by their `offsetMs`: the window the
 * playhead is in, the one before it, and the next one fetched ahead.
 */
export function useChatReplay(liveStreamId: string): LiveChatMessageView[] {
  const atSecond = usePlayerTime((seconds) => Math.floor(seconds));

  const api = useApi();
  const atMs = atSecond * MS_PER_SECOND;
  const current = Math.floor(atMs / REPLAY_WINDOW_MS);
  const windows = [current - 1, current, current + 1].filter((window) => window >= 0);
  const replies = useQueries({
    queries: windows.map((window) => chatReplayQueryOptions(api, liveStreamId, window)),
  });

  return replies
    .flatMap((reply) => reply.data ?? [])
    .filter((line) => line.offsetMs <= atMs)
    .slice(-REPLAY_LINES_SHOWN);
}
