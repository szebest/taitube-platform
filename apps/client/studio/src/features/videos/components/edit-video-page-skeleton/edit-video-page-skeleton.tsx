import { Skeleton } from '@vp/ui';

const FIELDS = ['title', 'description', 'visibility', 'category'];

/** The editor before its video has loaded: the heading, the fields and the save row, at the loaded page's rhythm. */
export function EditVideoPageSkeleton() {
  return (
    <div
      data-slot="edit-video-page-skeleton"
      aria-hidden="true"
      className="flex min-w-0 flex-col gap-section"
    >
      <Skeleton shape="text" className="h-8 w-2/3" />
      <div className="flex flex-col gap-stack">
        {FIELDS.map((field) => (
          <div key={field} className="flex flex-col gap-inline">
            <Skeleton shape="text" className="h-4 w-24" />
            <Skeleton radius="sm" className={field === 'description' ? 'h-32' : 'h-control-md'} />
          </div>
        ))}
      </div>
      <Skeleton radius="sm" className="h-control-md w-32" />
    </div>
  );
}
