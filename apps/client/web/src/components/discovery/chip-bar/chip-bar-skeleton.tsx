import { cn, Skeleton } from '@vp/ui';
import { PILL_HEIGHT } from './chip-bar.variants';

const SKELETON_PILLS = [
  { id: 'all', width: 'tw:w-[3.5rem]' },
  { id: 'film', width: 'tw:w-[4.5rem]' },
  { id: 'music', width: 'tw:w-[4rem]' },
  { id: 'cooking', width: 'tw:w-[5.5rem]' },
  { id: 'live', width: 'tw:w-[4.5rem]' },
  { id: 'news', width: 'tw:w-[3.5rem]' },
  { id: 'travel', width: 'tw:w-[6rem]' },
];

export function ChipBarSkeleton() {
  return (
    <div
      data-slot="chip-bar-skeleton"
      aria-hidden="true"
      className="tw:flex tw:gap-inline tw:overflow-hidden tw:py-inline tw:ps-gutter-compact tw:medium:ps-0"
    >
      {SKELETON_PILLS.map(({ id, width }) => (
        <Skeleton key={id} radius="chip" className={cn('tw:shrink-0', PILL_HEIGHT, width)} />
      ))}
    </div>
  );
}
