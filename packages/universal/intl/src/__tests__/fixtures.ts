import type { FormatContext } from '../context';
import { createIntlCache } from '../intl-cache';

export const NOW = '2026-09-22T18:30:00.000Z';

export const ARABIC_INDIC_DIGIT = /[٠-٩]/;
export const DEVANAGARI_DIGIT = /[०-९]/;
export const ASCII_DIGIT = /[0-9]/;

export function contextFor(locale: string, overrides: Partial<FormatContext> = {}): FormatContext {
  return { locale, timeZone: 'UTC', now: NOW, cache: createIntlCache(), ...overrides };
}
