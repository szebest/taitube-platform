import type { SortingState } from '@tanstack/react-table';
import { listAdminVideos } from '@vp/api-contracts';
import { z } from 'zod';

import type { AdminVideoFilters } from './admin-videos';

const { status, visibility, categoryId, q, sort, order } = listAdminVideos.query.shape;

/** The moderation page's filters and sort, as its URL spells them; a value the contract refuses reads as absent. */
export const ModerationSearchSchema = z.object({
  q: q.catch(undefined),
  status: status.catch(undefined),
  visibility: visibility.catch(undefined),
  categoryId: categoryId.catch(undefined),
  sort: sort.unwrap().optional().catch(undefined),
  order: order.unwrap().optional().catch(undefined),
});

export const STATUS_OPTIONS = status.unwrap().options;
export const VISIBILITY_OPTIONS = visibility.unwrap().options;

export type ModerationSearch = z.output<typeof ModerationSearchSchema>;

type Sort = NonNullable<AdminVideoFilters['sort']>;

/** The sortable columns and the sort each one asks the API for. */
const SORT_BY_COLUMN = new Map<string, Sort>([
  ['title', 'title'],
  ['viewsCount', 'views'],
  ['likesCount', 'likes'],
  ['createdAt', 'newest'],
]);

const DEFAULT_COLUMN = 'createdAt';

/** The table's sorting for the URL's sort and order. */
export function sortingOf({
  sort: current = 'newest',
  order: direction = 'desc',
}: ModerationSearch): SortingState {
  const column = [...SORT_BY_COLUMN].find(([, sort]) => sort === current);

  return [{ id: column?.[0] ?? DEFAULT_COLUMN, desc: direction === 'desc' }];
}

/** The URL's sort and order for what a header click left the table sorted by; none is the default. */
export function sortOf(sorting: SortingState): Pick<ModerationSearch, 'sort' | 'order'> {
  const [first] = sorting;
  const sort = first && SORT_BY_COLUMN.get(first.id);
  if (!(first && sort)) {
    return { sort: undefined, order: undefined };
  }

  return { sort, order: first.desc ? 'desc' : 'asc' };
}
