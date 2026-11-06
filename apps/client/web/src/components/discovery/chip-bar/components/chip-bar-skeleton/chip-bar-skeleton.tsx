import { cn, Skeleton } from '@vp/ui';
import { PILL_HEIGHT } from '#app/components/discovery/chip-bar/chip-bar.variants';

const SKELETON_PILLS = [
  { id: 'all', width: 'w-[3.5rem]' },
  { id: 'film', width: 'w-[4.5rem]' },
  { id: 'music', width: 'w-[4rem]' },
  { id: 'cooking', width: 'w-[5.5rem]' },
  { id: 'live', width: 'w-[4.5rem]' },
  { id: 'news', width: 'w-[3.5rem]' },
  { id: 'travel', width: 'w-[6rem]' },
];

export function ChipBarSkeleton() {
  return (
    <div
      data-slot="chip-bar-skeleton"
      aria-hidden="true"
      className="flex gap-inline overflow-hidden py-inline ps-gutter-compact medium:ps-0"
    >
      {SKELETON_PILLS.map(({ id, width }) => (
        <Skeleton key={id} radius="chip" className={cn('shrink-0', PILL_HEIGHT, width)} />
      ))}
    </div>
  );
}
