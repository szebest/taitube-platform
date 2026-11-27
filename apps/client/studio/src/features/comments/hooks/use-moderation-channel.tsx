import { createContext, type PropsWithChildren, useContext } from 'react';

export interface ModerationChannel {
  channelId: string;
  ownerId: string;
}

const ModerationChannelContext = createContext<ModerationChannel | undefined>(undefined);

export interface ModerationChannelProviderProps extends PropsWithChildren {
  channel: ModerationChannel;
}

/** The channel the moderation pages act on, handed down by the route, since a feature never reads another feature's context. */
export function ModerationChannelProvider({ channel, children }: ModerationChannelProviderProps) {
  return <ModerationChannelContext value={channel}>{children}</ModerationChannelContext>;
}

export function useModerationChannel(): ModerationChannel {
  const channel = useContext(ModerationChannelContext);
  if (!channel) {
    throw new Error('useModerationChannel must be used within ModerationChannelProvider');
  }
  return channel;
}
