import { LiveChatComposer } from './components/live-chat-composer/live-chat-composer';
import { LiveChatList } from './components/live-chat-list/live-chat-list';
import { LiveChatMenu, LiveChatOpacity } from './components/live-chat-menu/live-chat-menu';
import { LiveChatMessage } from './components/live-chat-message/live-chat-message';
import { LiveChatEnded, LiveChatHeader, LiveChatPinned, LiveChatRoot } from './live-chat';

export const LiveChat = {
  Root: LiveChatRoot,
  Header: LiveChatHeader,
  Menu: LiveChatMenu,
  Opacity: LiveChatOpacity,
  Pinned: LiveChatPinned,
  List: LiveChatList,
  Message: LiveChatMessage,
  Composer: LiveChatComposer,
  Ended: LiveChatEnded,
};

export { useLiveChat } from './live-chat.context';
export { liveChatStyles } from './live-chat.variants';
export { LiveChatSkeleton } from './components/live-chat-skeleton/live-chat-skeleton';
export type { LiveChatLayout } from './types';
