import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from 'react';

export interface PlayerChannel {
  seek(seconds: number): void;
  currentTime(): number;
  theater(): boolean;
  toggleTheater(): void;
  fullscreen(): boolean;
  subscribe(listener: () => void): () => void;
  subscribeEnded(listener: () => void): () => void;
}

interface PlayerChannelEnd extends PlayerChannel {
  attach(seek: (seconds: number) => void): () => void;
  publish(seconds: number): void;
  publishFullscreen(fullscreen: boolean): void;
  end(): void;
}

function createPlayerChannel(): PlayerChannelEnd {
  let target: ((seconds: number) => void) | undefined;
  let time = 0;
  let theater = false;
  let fullscreen = false;
  const listeners = new Set<() => void>();
  const endListeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    seek: (seconds) => target?.(seconds),
    currentTime: () => time,
    theater: () => theater,
    toggleTheater: () => {
      theater = !theater;
      notify();
    },
    fullscreen: () => fullscreen,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeEnded: (listener) => {
      endListeners.add(listener);
      return () => endListeners.delete(listener);
    },
    end: () => {
      for (const listener of endListeners) listener();
    },
    attach: (seek) => {
      target = seek;
      return () => {
        target = undefined;
      };
    },
    publish: (seconds) => {
      time = seconds;
      notify();
    },
    publishFullscreen: (next) => {
      fullscreen = next;
      notify();
    },
  };
}

const PlayerChannelContext = createContext<PlayerChannelEnd | undefined>(undefined);

/** Lets a sibling of the player seek it and read where it is, without owning its engine. */
export function PlayerChannelProvider({ children }: PropsWithChildren) {
  const [channel] = useState(createPlayerChannel);

  return <PlayerChannelContext value={channel}>{children}</PlayerChannelContext>;
}

/** The engine's end of the channel; without a provider the player stands alone. */
export function useOfferedPlayerChannel(): PlayerChannelEnd | undefined {
  return useContext(PlayerChannelContext);
}

export function usePlayerSeek(): PlayerChannel {
  const channel = useContext(PlayerChannelContext);
  if (!channel) throw new Error('usePlayerSeek must be used within PlayerChannelProvider');
  return channel;
}

/** Reads a value derived from the playhead; it re-renders only when the derived value changes. */
export function usePlayerTime<Selected>(select: (seconds: number) => Selected): Selected {
  const { subscribe, currentTime } = usePlayerSeek();

  return useSyncExternalStore(
    subscribe,
    () => select(currentTime()),
    () => select(0)
  );
}

/** Runs `onEnded` each time the video reaches its end; without a provider nothing ends. */
export function useOnPlayerEnded(onEnded: () => void): void {
  const channel = useContext(PlayerChannelContext);
  const handleEnded = useEffectEvent(() => onEnded());

  useEffect(() => {
    const unsubscribe = channel?.subscribeEnded(() => handleEnded());
    return unsubscribe;
  }, [channel]);
}

function useChannelFlag(read: (channel: PlayerChannel) => boolean): boolean {
  const channel = useContext(PlayerChannelContext);
  const subscribe = useCallback(
    (listener: () => void) => channel?.subscribe(listener) ?? (() => undefined),
    [channel]
  );

  return useSyncExternalStore(
    subscribe,
    () => (channel ? read(channel) : false),
    () => false
  );
}

/** Whether the viewer put the player in theater mode; false where no provider offers a channel. */
export function usePlayerTheater(): boolean {
  return useChannelFlag((channel) => channel.theater());
}

/** Whether the player fills the screen; false where no provider offers a channel. */
export function usePlayerFullscreen(): boolean {
  return useChannelFlag((channel) => channel.fullscreen());
}
