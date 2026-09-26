import { type Result, err, ok } from '@vp/result';
import { type InvalidVideoTags, invalidVideoTags } from './failures';

const VIDEO_TAG_LIMITS = { maxTags: 30, maxLength: 30 } as const;

function withoutRepeats(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Trimmed, and a tag repeated in another case counts once, before either limit is applied. */
export function validateVideoTags(tags: readonly string[]): Result<string[], InvalidVideoTags> {
  const normalized = withoutRepeats(tags.map((tag) => tag.trim()));
  const { maxTags, maxLength } = VIDEO_TAG_LIMITS;
  const fits = (tag: string) => tag.length > 0 && tag.length <= maxLength;

  return normalized.length <= maxTags && normalized.every(fits)
    ? ok(normalized)
    : err(invalidVideoTags(VIDEO_TAG_LIMITS));
}
