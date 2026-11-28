import { isOk } from '@kit/result';
import {
  WATCH_PARTY_DISCOVERY_ACCESS,
  WATCH_PARTY_DISCOVERY_KINDS,
  WATCH_PARTY_DISCOVERY_SIZES,
  WATCH_PARTY_DISCOVERY_SORTS,
  WATCH_PARTY_DISCOVERY_STATUSES,
} from '@vp/domain';
import type { PartyDiscoveryFilters } from '@vp/queries';
import { validateSearchQuery } from '@vp/validation';
import { z } from 'zod';

/** A value the URL carries that the schema refuses falls back to its default, never to an error page. */
function lenient<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => schema.safeParse(value).data, schema.optional());
}

const FlagSchema = z.literal(true);

const flag = z.preprocess(
  (value) => (value === 'true' || value === true ? true : undefined),
  FlagSchema.optional()
);

export const DiscoverySearchSchema = z.object({
  q: z.string().optional(),
  status: lenient(z.enum(WATCH_PARTY_DISCOVERY_STATUSES)),
  category: lenient(z.uuid()),
  language: lenient(z.string().regex(/^[a-z]{2,3}$/)),
  access: lenient(z.enum(WATCH_PARTY_DISCOVERY_ACCESS)),
  size: lenient(z.enum(WATCH_PARTY_DISCOVERY_SIZES)),
  space: flag,
  followed: flag,
  creator: flag,
  kind: lenient(z.enum(WATCH_PARTY_DISCOVERY_KINDS)),
  sort: lenient(z.enum(WATCH_PARTY_DISCOVERY_SORTS)),
});

export type DiscoverySearch = z.infer<typeof DiscoverySearchSchema>;

/** Every filter at its default: what the bare `/parties` asks for. */
export function filtersOf(search: DiscoverySearch): PartyDiscoveryFilters {
  const text = validateSearchQuery(search.q ?? '');
  return {
    ...(isOk(text) ? { q: text.value } : {}),
    status: search.status ?? 'all',
    ...(search.category ? { category: search.category } : {}),
    ...(search.language ? { language: search.language } : {}),
    access: search.access ?? 'any',
    size: search.size ?? 'any',
    space: search.space ?? false,
    followed: search.followed ?? false,
    creator: search.creator ?? false,
    kind: search.kind ?? 'any',
    sort: search.sort ?? 'members',
  };
}

/** Whether anything but the sort narrows the list, which is what "Clear filters" undoes. */
export function isNarrowed(filters: PartyDiscoveryFilters): boolean {
  const { sort: _sort, ...narrowing } = filters;
  return (
    Boolean(narrowing.q || narrowing.category || narrowing.language) ||
    narrowing.status !== 'all' ||
    narrowing.access !== 'any' ||
    narrowing.size !== 'any' ||
    narrowing.kind !== 'any' ||
    narrowing.space ||
    narrowing.followed ||
    narrowing.creator
  );
}
