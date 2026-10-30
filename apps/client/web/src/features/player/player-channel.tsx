import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react';

export interface PlayerChannel {
  seek(seconds: number): void;
  currentTime(): number;
  subscribe(listener: () => void): () => void;
}

interface PlayerChannelEnd extends PlayerChannel {
  attach(seek: (seconds: number) => void): () => void;
  publish(seconds: number): void;
}

function createPlayerChannel(): PlayerChannelEnd {
  let target: ((seconds: number) => void) | undefined;
  let time = 0;
  const listeners = new Set<() => void>();

  return {
    seek: (seconds) => target?.(seconds),
    currentTime: () => time,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    attach: (seek) => {
      target = seek;
      return () => {
        target = undefined;
      };
    },
    publish: (seconds) => {
      time = seconds;
      for (const listener of listeners) listener();
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
