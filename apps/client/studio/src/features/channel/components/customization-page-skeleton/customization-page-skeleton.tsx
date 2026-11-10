import { Skeleton } from '@vp/ui';

const SECTIONS = ['identity', 'links', 'images', 'colour', 'captions'];

/** Customization before its channel has loaded: the heading and the sections as cards. */
export function CustomizationPageSkeleton() {
  return (
    <div
      data-slot="customization-page-skeleton"
      aria-hidden="true"
      className="flex min-w-0 flex-col gap-stack"
    >
      <Skeleton shape="text" className="h-8 w-1/3" />
      {SECTIONS.map((section) => (
        <Skeleton key={section} radius="card" className="h-40 w-full" />
      ))}
    </div>
  );
}
