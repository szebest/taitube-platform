import { createCompoundContext } from '@vp/ui';
import type { RefObject } from 'react';
import type { LiveChatLayout } from './types';

export const [LiveChatContext, useLiveChat] = createCompoundContext<{
  layout: LiveChatLayout;
  following: boolean;
  setFollowing: (following: boolean) => void;
  jumpToLatest: () => void;
  unseen: number;
  setUnseen: (unseen: number) => void;
  announce: boolean;
  setAnnounce: (announce: boolean) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  listRef: RefObject<HTMLDivElement | null>;
  onSend: (text: string) => void;
  onEndReached?: () => void;
}>('LiveChat');
