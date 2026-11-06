import { err, ok, type Result } from '@vp/result';
import { type InvalidField, invalidLength, type LengthBounds } from '../failures';
import { normalizePlainText, withinLength } from '../plain-text';

/** Also the `char_length` check every chat table puts on a line. */
export const CHAT_MESSAGE_BOUNDS = {
  minLength: 1,
  maxLength: 200,
} as const satisfies LengthBounds;

export type InvalidChatMessage = InvalidField<LengthBounds>;

/** A chat line is one line: line breaks fold to spaces, so a sender cannot push the chat up. */
export function validateChatMessage(message: string): Result<string, InvalidChatMessage> {
  const text = normalizePlainText(message.replace(/\s+/g, ' '));
  return withinLength(text, CHAT_MESSAGE_BOUNDS)
    ? ok(text)
    : err(invalidLength('message', CHAT_MESSAGE_BOUNDS));
}
