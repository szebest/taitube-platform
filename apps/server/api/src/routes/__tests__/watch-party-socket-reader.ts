import type { WatchPartyServerFrame } from '@vp/api-contracts';
import type { SocketClient } from './socket-client';

type Frame = WatchPartyServerFrame;

/** Frames one socket heard, read in order: each wait starts after the frame the last one found. */
export function reader(client: SocketClient<Frame>) {
  let seen = 0;
  return async <T extends Frame['type']>(
    type: T,
    matches: (frame: Extract<Frame, { type: T }>) => boolean = () => true
  ): Promise<Extract<Frame, { type: T }>> => {
    for (;;) {
      seen += 1;
      const frame = (await client.next(seen))[seen - 1];
      if (frame?.type === type && matches(frame as Extract<Frame, { type: T }>)) {
        return frame as Extract<Frame, { type: T }>;
      }
    }
  };
}
