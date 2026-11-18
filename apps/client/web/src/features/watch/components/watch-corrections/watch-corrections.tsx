import { useFormat, useT } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { useQuery } from '@tanstack/react-query';
import { videoDuration } from '@vp/intl';
import { correctionsQueryOptions, useApi } from '@vp/queries';
import { usePlayerSeek } from '#app/components/player/taitube-player';

/** The corrections of a video under its description, so one that was on screen while the viewer looked away is still there. */
export function WatchCorrections({ videoId }: { videoId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const { format } = useFormat();
  const { seek } = usePlayerSeek();
  const { data } = useQuery(correctionsQueryOptions(api, videoId));
  const items = data?.items ?? [];

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="watch-corrections-title" className="flex flex-col gap-2">
      <h2 id="watch-corrections-title" className="text-title">
        {tOr('watch.correctionsTitle', {}, '')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map(({ id, startMs, text }) => {
          const time = unwrapOr(format(videoDuration(startMs / 1000)), '');
          return (
            <li key={id} className="flex gap-2">
              <button
                type="button"
                className="tabular-nums text-link"
                aria-label={tOr('watch.correctionsSeek', { time }, '')}
                onClick={() => seek(startMs / 1000)}
              >
                {time}
              </button>
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
