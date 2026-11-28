import type { ContentSection, SectionFilters } from '@vp/domain';

export const MANUAL_SOURCES = ['picked', 'playlist', 'start_here'] as const;

export const SOURCE_CHOICES = [
  'videos',
  'shorts',
  'posts',
  'live',
  'playlists',
  'start_here',
] as const;
export type SourceChoice = (typeof SOURCE_CHOICES)[number];

export const LAYOUT_CHOICES = ['shelf', 'grid', 'list', 'hero', 'masonry'] as const;
export type LayoutChoice = (typeof LAYOUT_CHOICES)[number];

const PLAYLIST_PREFIX = 'playlist:';

export const isManualSource = ({ source }: ContentSection): boolean =>
  MANUAL_SOURCES.some((type) => type === source.type);

export const isMasonryAllowed = ({ source }: ContentSection): boolean => source.type === 'posts';

/** The value a source `Select` holds: the type, or `playlist:<id>` for one playlist. */
export function sourceValue({ source }: ContentSection): string {
  return source.type === 'playlist' ? `${PLAYLIST_PREFIX}${source.playlistId}` : source.type;
}

function keepsValid(section: ContentSection): ContentSection {
  const sort = section.sort === 'manual' && !isManualSource(section) ? 'newest' : section.sort;
  const layout =
    section.layout.type === 'masonry' && !isMasonryAllowed(section)
      ? { type: 'shelf' as const }
      : section.layout;
  return { ...section, sort, layout };
}

export function withSource(section: ContentSection, value: string): ContentSection {
  const choice = SOURCE_CHOICES.find((type) => type === value);
  if (choice !== undefined) {
    return keepsValid({ ...section, source: { type: choice } });
  }
  if (value.startsWith(PLAYLIST_PREFIX)) {
    const playlistId = value.slice(PLAYLIST_PREFIX.length);
    return keepsValid({ ...section, source: { type: 'playlist', playlistId } });
  }
  return section;
}

export function withLayout(section: ContentSection, choice: LayoutChoice): ContentSection {
  switch (choice) {
    case 'grid':
      return { ...section, layout: { type: 'grid', columns: 3 } };
    case 'hero':
      return { ...section, layout: { type: 'hero' }, itemCount: 1 };
    default:
      return { ...section, layout: { type: choice } };
  }
}

export function withColumns(section: ContentSection, columns: number): ContentSection {
  return section.layout.type === 'grid'
    ? { ...section, layout: { type: 'grid', columns } }
    : section;
}

export function withFilters(
  section: ContentSection,
  changes: Partial<SectionFilters>
): ContentSection {
  return { ...section, filters: { ...section.filters, ...changes } };
}

export function numberOrNull(text: string): number | null {
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

const SECONDS_PER_MINUTE = 60;

export function withDurationMinutes(
  section: ContentSection,
  bound: 'minSeconds' | 'maxSeconds',
  text: string
): ContentSection {
  const minutes = numberOrNull(text);
  const next = {
    minSeconds: section.filters.duration?.minSeconds ?? null,
    maxSeconds: section.filters.duration?.maxSeconds ?? null,
    [bound]: minutes === null ? null : minutes * SECONDS_PER_MINUTE,
  };
  const duration = next.minSeconds === null && next.maxSeconds === null ? null : next;
  return withFilters(section, { duration });
}

export function withLastDays(section: ContentSection, text: string): ContentSection {
  const days = numberOrNull(text);
  return withFilters(section, {
    dateRange: days === null ? null : { type: 'last_days', days },
  });
}
