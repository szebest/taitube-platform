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
      className="tw:flex tw:flex-col tw:gap-inline tw:rounded-card tw:bg-surface tw:p-inset-card"
    >
      <p className="tw:m-0 tw:text-overline tw:text-accent-ink tw:uppercase">{pickOfTheDay}</p>
      {video === null ? (
        <p className="tw:m-0 tw:text-body-sm tw:text-fg-muted">
          {tOr('studio.pickPreviewEmpty', {}, '')}
        </p>
      ) : (
        <>
          <VideoThumbnail.Root className="tw:w-full tw:max-w-[20rem]">
            <VideoThumbnail.Image src={video.thumbnailUrl ?? video.posterUrl} />
          </VideoThumbnail.Root>
          <h3 className="tw:m-0 tw:text-headline">
            {video.title ?? tOr('studio.pickUntitled', {}, '')}
          </h3>
          {text !== '' && (
            <p className="tw:m-0 tw:line-clamp-3 tw:max-w-reading-max tw:font-editorial tw:text-editorial tw:text-fg">
              {text}
            </p>
          )}
          {window !== '' && <p className="tw:m-0 tw:text-caption tw:text-fg-muted">{window}</p>}
        </>
      )}
    </section>
  );
}
