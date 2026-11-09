import { LiveChat } from '#app/components/live/live-chat';
import { PartyChatComposer, PartyChatLine, PartyChatRoot } from './party-chat';

export const PartyChat = {
  Root: PartyChatRoot,
  Pinned: LiveChat.Pinned,
  List: LiveChat.List,
  Line: PartyChatLine,
  Composer: PartyChatComposer,
};
export type { PartyChatComposerProps, PartyChatLineProps } from './party-chat';
export type { PartyChatComposerState } from './types';
