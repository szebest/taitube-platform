import { LiveChatEnded, LiveChatHeader, LiveChatPinned, LiveChatRoot } from './live-chat';
import { LiveChatComposer } from './live-chat-composer';
import { LiveChatList } from './live-chat-list';
import { LiveChatMenu, LiveChatOpacity } from './live-chat-menu';
import { LiveChatMessage } from './live-chat-message';

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
export { LiveChatSkeleton } from './live-chat-skeleton';
