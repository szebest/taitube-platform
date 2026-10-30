import { createColumnHelper } from '@tanstack/react-table';
import { CREATOR_LIBRARY_SORTS } from '@vp/domain';
import { type CountValue, publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';

import type { DataTableColumnMeta, DataTableFeatures } from '#app/components/table/data-table';
import type { LibrarySort } from '../api/library-search';
import { type CreatorVideo, LibraryVideoRow } from './library-video-row';
import { VideoStatusBadge } from './video-status-badge';

const column = createColumnHelper<DataTableFeatures, CreatorVideo>();

const WIDTHS = {
  title: { width: '36%' },
  status: { width: '12%' },
  visibility: { width: '10%' },
  date: { width: '12%', numeric: true },
  views: { width: '9%', numeric: true },
  likes: { width: '9%', numeric: true },
  comments: { width: '9%', numeric: true },
  actions: { width: '3%' },
} as const satisfies Record<string, DataTableColumnMeta>;

export const LIBRARY_SKELETON_COLUMNS = Object.values(WIDTHS).map((meta) => ({ meta }));

export const SORT_COLUMNS = {
  newest: 'date',
  views: 'views',
  likes: 'likes',
  comments: 'comments',
} as const satisfies Record<LibrarySort, string>;

type HeadMessage =
  | 'studio.libraryColumnVideo'
  | 'studio.libraryColumnStatus'
  | 'studio.libraryColumnVisibility'
  | 'studio.libraryColumnDate'
  | 'studio.libraryColumnViews'
  | 'studio.libraryColumnLikes'
  | 'studio.libraryColumnComments'
  | 'studio.libraryColumnActions';

function Head({ message }: { message: HeadMessage }) {
  const { tOr } = useT();
  return tOr(message, {}, '');
}

function Visibility({ video }: { video: CreatorVideo }) {
  const { tOr } = useT();
  return tOr('videos.visibility', { visibility: video.visibility }, '');
}

const count = (value: number): CountValue => ({ type: 'count', value });

const sortable = { sortDescFirst: true, enableSortingRemoval: false } as const;

export function createLibraryColumns(onInspect: (videoId: string) => void) {
  return column.columns([
    column.display({
      id: 'title',
      header: () => <Head message="studio.libraryColumnVideo" />,
      cell: ({ row }) => <LibraryVideoRow.Title video={row.original} onInspect={onInspect} />,
      meta: WIDTHS.title,
    }),
    column.display({
      id: 'status',
      header: () => <Head message="studio.libraryColumnStatus" />,
      cell: ({ row }) => <VideoStatusBadge status={row.original.status} />,
      meta: WIDTHS.status,
    }),
    column.display({
      id: 'visibility',
      header: () => <Head message="studio.libraryColumnVisibility" />,
      cell: ({ row }) => <Visibility video={row.original} />,
      meta: WIDTHS.visibility,
    }),
    column.accessor('createdAt', {
      id: 'date',
      header: () => <Head message="studio.libraryColumnDate" />,
      cell: ({ getValue }) => (
        <time dateTime={getValue()}>
          <Format value={publishedAt(getValue()).relative} />
        </time>
      ),
      meta: WIDTHS.date,
      ...sortable,
    }),
    column.accessor((video) => video.viewsCount ?? 0, {
      id: 'views',
      header: () => <Head message="studio.libraryColumnViews" />,
      cell: ({ getValue }) => <Format value={count(getValue())} />,
      meta: WIDTHS.views,
      ...sortable,
    }),
    column.accessor((video) => video.likesCount ?? 0, {
      id: 'likes',
      header: () => <Head message="studio.libraryColumnLikes" />,
      cell: ({ getValue }) => <Format value={count(getValue())} />,
      meta: WIDTHS.likes,
      ...sortable,
    }),
    column.accessor('commentsCount', {
      id: 'comments',
      header: () => <Head message="studio.libraryColumnComments" />,
      cell: ({ getValue }) => <Format value={count(getValue())} />,
      meta: WIDTHS.comments,
      ...sortable,
    }),
    column.display({
      id: 'actions',
      header: () => <Head message="studio.libraryColumnActions" />,
      cell: ({ row }) => <LibraryVideoRow.Actions video={row.original} />,
      meta: WIDTHS.actions,
    }),
  ]);
}

export const sortOfColumn = (columnId: string | undefined): LibrarySort | undefined =>
  CREATOR_LIBRARY_SORTS.find((sort) => SORT_COLUMNS[sort] === columnId);
