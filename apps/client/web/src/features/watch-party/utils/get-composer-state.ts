import type { PartyChatComposerState } from '#app/components/party/party-chat';

export interface ComposerInput {
  connected: boolean;
  chatEnabled: boolean;
  guest: boolean;
  canPost: boolean;
  muted: boolean;
}

/** Which composer the chat shows: the connection first, then the room, then what this viewer may do. */
export function getComposerState({
  connected,
  chatEnabled,
  guest,
  canPost,
  muted,
}: ComposerInput): PartyChatComposerState {
  if (!connected) {
    return 'offline';
  }
  if (!chatEnabled) {
    return 'off';
  }
  if (guest) {
    return 'guest';
  }
  if (muted) {
    return 'muted';
  }
  return canPost ? 'open' : 'off';
}
