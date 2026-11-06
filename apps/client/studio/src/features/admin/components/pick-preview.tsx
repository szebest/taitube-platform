import { VideoThumbnail } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useUiCopy } from '@vp/ui';

import type { PickVideo } from '#app/features/admin/api/pick-videos';

export interface PickPreviewProps {
  video: PickVideo | null;
  /** The note as typed; blank shows none, as home does. */
  note: string;
  /** The window, already a finished string. */
  window: string;
}

/** What home will show for the pick, from the same pieces: kicker, thumbnail, title, the note in the editorial face, the window. */
export function PickPreview({ video, note, window }: PickPreviewProps) {
  const { tOr } = useT();
  const { pickOfTheDay } = useUiCopy();
  const text = note.trim();

  return (
    <section
      data-slot="pick-preview"
      aria-label={tOr('studio.pickPreview', {}, '')}
      className="flex flex-col gap-inline rounded-card bg-surface p-inset-card"
    >
      <p className="m-0 text-overline text-accent-ink uppercase">{pickOfTheDay}</p>
      {video === null ? (
        <p className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.pickPreviewEmpty', {}, '')}
        </p>
      ) : (
        <>
          <VideoThumbnail.Root className="w-full max-w-[20rem]">
            <VideoThumbnail.Image src={video.thumbnailUrl ?? video.posterUrl} />
          </VideoThumbnail.Root>
          <h3 className="m-0 text-headline">
            {video.title ?? tOr('studio.pickUntitled', {}, '')}
          </h3>
          {text !== '' && (
            <p className="m-0 line-clamp-3 max-w-reading-max font-editorial text-editorial text-fg">
              {text}
            </p>
          )}
          {window !== '' && <p className="m-0 text-caption text-fg-muted">{window}</p>}
        </>
      )}
    </section>
  );
}
