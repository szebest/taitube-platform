export const CREATOR_LIBRARY_SORTS = ['newest', 'views', 'likes', 'comments'] as const;

export type CreatorLibrarySort = (typeof CREATOR_LIBRARY_SORTS)[number];

export const LIBRARY_SORTS = [...CREATOR_LIBRARY_SORTS, 'title'] as const;

export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

export interface CreatorLibraryRow {
  id: string;
  createdAt: Date;
  title?: string | null;
  viewsCount?: number;
  likesCount?: number;
  commentsCount?: number;
}

type CounterSort = Exclude<CreatorLibrarySort, 'newest'>;

export const CREATOR_LIBRARY_COUNTERS = {
  views: 'viewsCount',
  likes: 'likesCount',
  comments: 'commentsCount',
} as const satisfies Record<CounterSort, keyof CreatorLibraryRow>;

export type CreatorLibraryCursor =
  | { sort: 'newest'; value: Date; id: string }
  | { sort: 'title'; value: string; id: string }
  | { sort: CounterSort; value: number; id: string };

export function creatorLibraryCursorOf(
  row: CreatorLibraryRow,
  sort: LibrarySort
): CreatorLibraryCursor {
  if (sort === 'newest') return { sort, value: row.createdAt, id: row.id };
  if (sort === 'title') return { sort, value: row.title ?? '', id: row.id };
  return { sort, value: row[CREATOR_LIBRARY_COUNTERS[sort]] ?? 0, id: row.id };
}
