import type { LengthBounds } from './failures';

const CONTROL_EXCEPT_LINE_BREAK_AND_TAB = /[^\P{Cc}\n\t]/gu;

/**
 * User text is plain: markup is kept as typed and escaped wherever it is rendered, because
 * stripping tags here would be a hand-rolled HTML parser. Control characters go, line breaks and
 * tabs stay, and the ends are trimmed.
 */
export function normalizePlainText(value: string): string {
  return value.replace(CONTROL_EXCEPT_LINE_BREAK_AND_TAB, '').trim();
}

/** Counts code points, so an emoji costs one character rather than two UTF-16 units. */
export function withinLength(text: string, { minLength, maxLength }: LengthBounds): boolean {
  const length = Array.from(text).length;
  return length >= minLength && length <= maxLength;
}
