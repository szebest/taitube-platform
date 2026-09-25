import type { DateTimeValue } from '../formatters/date-time';
import type { RelativeValue } from '../formatters/relative';

export interface PublishedAt {
  readonly relative: RelativeValue;
  readonly absolute: DateTimeValue;
}

/** `3 days ago` to read, never `in 2 minutes`, and the exact date and time for the `title` beside it. */
export function publishedAt(iso: string, now?: string): PublishedAt {
  return {
    relative: { type: 'relative', value: iso, now, options: { pastOnly: true } },
    absolute: { type: 'dateTime', value: iso },
  };
}
