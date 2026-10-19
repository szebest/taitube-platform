import type { ContractResult, streamMyEvents } from '@vp/api-contracts';

export type UserStreamEvent = ContractResult<typeof streamMyEvents>;

/** The part of `EventSource` the stream uses, so a spec can drive one. */
export interface UserEventSource {
  readonly readyState: number;
  readonly CLOSED: number;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

/** The browser APIs the stream runs on, handed in so a spec can open several tabs in one process. */
export interface UserEventBrowser {
  locks: Pick<LockManager, 'request'>;
  openChannel: (name: string) => BroadcastChannel;
  openSource: (url: string) => UserEventSource;
}

export interface UserEventConnection {
  /** Names the lock and the channel: the tabs of one signed-in user share both. */
  name: string;
  browser: UserEventBrowser;
  onEvent: (event: UserStreamEvent) => void;
}

export function connectUserEvents(_connection: UserEventConnection): () => void {
  return () => undefined;
}
