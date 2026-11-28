import { z } from 'zod';

/** The video a pasted Taitube link or bare ID names: the last path segment of a link, or the text itself. */
export function parseVideoId(text: string): string | null {
  const trimmed = text.trim();
  const candidate = URL.canParse(trimmed)
    ? new URL(trimmed).pathname.split('/').findLast(Boolean)
    : trimmed;
  const parsed = z.uuid().safeParse(candidate);

  return parsed.success ? parsed.data : null;
}
