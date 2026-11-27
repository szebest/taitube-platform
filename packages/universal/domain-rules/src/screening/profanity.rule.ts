import { type ScreeningMetadata, languageOf, wordsOf } from './metadata-text';
import { FALLBACK_PROFANITY_LANGUAGE, PROFANITY_WORDS } from './profanity-words';

/** The distinct listed words the title, description and tags use, in the order they first appear. */
export function findProfanity(metadata: ScreeningMetadata): string[] {
  const list =
    PROFANITY_WORDS[languageOf(metadata.locale)] ?? PROFANITY_WORDS[FALLBACK_PROFANITY_LANGUAGE];
  const text = [metadata.title, metadata.description ?? '', ...metadata.tags].join(' ');
  return [...new Set(wordsOf(text).filter((word) => list?.includes(word)))];
}
