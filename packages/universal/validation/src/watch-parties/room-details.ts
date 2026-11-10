import { type Result, err, ok } from '@vp/result';
import { type InvalidField, type LengthBounds, invalidField, invalidLength } from '../failures';
import { normalizePlainText, withinLength } from '../plain-text';

export const ROOM_NAME_BOUNDS = { minLength: 1, maxLength: 60 } as const satisfies LengthBounds;
export const ROOM_PASSWORD_BOUNDS = { minLength: 4, maxLength: 64 } as const satisfies LengthBounds;
export const ROLE_NAME_BOUNDS = { minLength: 1, maxLength: 32 } as const satisfies LengthBounds;

export type InvalidRoomName = InvalidField<LengthBounds> | InvalidField<{ reason: 'url' }>;
export type InvalidRoomPassword = InvalidField<LengthBounds>;
export type InvalidRoleName = InvalidField<LengthBounds>;

/** A scheme or a `www.` host: a listed room name is not a place to advertise a link. */
const LINK = /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)/i;

function oneLine(value: string): string {
  return normalizePlainText(value.replace(/\s+/g, ' '));
}

export function validateRoomName(name: string): Result<string, InvalidRoomName> {
  const text = oneLine(name);
  if (!withinLength(text, ROOM_NAME_BOUNDS)) return err(invalidLength('name', ROOM_NAME_BOUNDS));
  if (LINK.test(text)) {
    return err(invalidField('name', 'name must not contain a link', { reason: 'url' as const }));
  }
  return ok(text);
}

/** Kept exactly as typed, spaces included: it is hashed, never shown. */
export function validateRoomPassword(password: string): Result<string, InvalidRoomPassword> {
  return withinLength(password, ROOM_PASSWORD_BOUNDS)
    ? ok(password)
    : err(invalidLength('password', ROOM_PASSWORD_BOUNDS));
}

export function validateRoleName(name: string): Result<string, InvalidRoleName> {
  const text = oneLine(name);
  return withinLength(text, ROLE_NAME_BOUNDS)
    ? ok(text)
    : err(invalidLength('name', ROLE_NAME_BOUNDS));
}
