import { err, ok, type Result } from '@vp/result';
import { type InvalidField, invalidLength, type LengthBounds } from '../failures';
import { normalizePlainText, withinLength } from '../plain-text';

/** Also the database's `char_length` check on `live_chat_messages.message`. */
export const LIVE_CHAT_MESSAGE_BOUNDS = {
  minLength: 1,
  maxLength: 200,
} as const satisfies LengthBounds;

export type InvalidLiveChatMessage = InvalidField<LengthBounds>;

/** A chat line is one line: line breaks fold to spaces, so a sender cannot push the chat up. */
export function validateLiveChatMessage(message: string): Result<string, InvalidLiveChatMessage> {
  const text = normalizePlainText(message.replace(/\s+/g, ' '));
  return withinLength(text, LIVE_CHAT_MESSAGE_BOUNDS)
    ? ok(text)
    : err(invalidLength('message', LIVE_CHAT_MESSAGE_BOUNDS));
}
