export interface ScreeningMetadata {
  title: string;
  description: string | null;
  tags: readonly string[];
  /** The language the text is written in, as a BCP 47 tag such as `pl` or `en-GB`. */
  locale: string;
  /** Titles of the creator's recent uploads, for the same-title check. */
  recentTitles: readonly string[];
}

const NON_WORD = /[^\p{L}\p{N}]+/u;

export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(NON_WORD)
    .filter((word) => word !== '');
}

export function normalizedTitle(title: string): string {
  return wordsOf(title).join(' ');
}

export function languageOf(locale: string): string {
  return locale.split('-')[0]?.toLowerCase() ?? '';
}

export function bodyOf({ title, description }: ScreeningMetadata): string {
  return description ? `${title}\n${description}` : title;
}
