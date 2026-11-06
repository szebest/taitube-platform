import type { VideoSummary } from '@vp/api-contracts';

import { VideoCardSkeleton } from '@vp/components';
import { useRef } from 'react';
import { useGridColumns } from '#app/hooks/use-grid-columns';
import { useWindowRows } from '#app/hooks/use-window-rows';
import { FeedVideoCard } from '../feed-video-card';

const GRID =
  'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(var(--layout-card-min),1fr))] gap-x-grid-x gap-y-grid-y p-0';

const SKELETON_KEYS = Array.from({ length: 12 }, (_, index) => `skeleton-${index}`);

const ESTIMATED_ROW_HEIGHT = 300;

export interface VideoGridProps {
  videos: VideoSummary[];
}

export function VideoGrid({ videos }: VideoGridProps) {
  const list = useRef<HTMLUListElement>(null);
  const columns = useGridColumns(list);
  const { rows, padding, measureRow } = useWindowRows({
    list,
    rowCount: Math.ceil(videos.length / columns),
    estimateRowHeight: ESTIMATED_ROW_HEIGHT,
    getRowKey: (row) => videos[row * columns]?.id ?? String(row),
  });
  const firstRow = rows.at(0)?.index ?? 0;
  const lastRow = rows.at(-1)?.index ?? -1;

  return (
    <ul ref={list} className={GRID} style={padding}>
      {videos.slice(firstRow * columns, (lastRow + 1) * columns).map((video, offset) => {
        const isRowStart = offset % columns === 0;

        return (
          <li
            key={video.id}
            ref={isRowStart ? measureRow : undefined}
            data-index={isRowStart ? firstRow + offset / columns : undefined}
          >
            <FeedVideoCard video={video} />
          </li>
        );
      })}
    </ul>
  );
}

export function VideoGridSkeleton() {
  return (
    <ul aria-hidden="true" className={GRID}>
      {SKELETON_KEYS.map((key) => (
        <li key={key}>
          <VideoCardSkeleton variant="grid" />
        </li>
      ))}
    </ul>
  );
}
