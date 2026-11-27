import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Badge } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { dropOffMoments } from '@vp/domain-rules';
import { videoDuration } from '@vp/intl-formats';
import { useApi, videoQueryOptions, videoRetentionQueryOptions } from '@vp/queries';
import { useT } from '#app/lib/messages';

const MS_PER_SECOND = 1000;

export interface DropOffBadgesProps {
  videoId: string;
}

/** `dropOffMoments` over the retention curve below, so each badge names a step of the chart it sits over. */
export function DropOffBadges({ videoId }: DropOffBadgesProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const api = useApi();
  const retention = useQuery(videoRetentionQueryOptions(api, videoId));
  const video = useQuery(videoQueryOptions(api, videoId));
  const text = (value: Parameters<typeof format>[0]) => unwrapOr(format(value), '');
  const moments =
    retention.data && video.data?.durationMs
      ? dropOffMoments(retention.data.curve, video.data.durationMs / MS_PER_SECOND)
      : [];

  if (moments.length === 0) {
    return null;
  }

  return (
    <section data-slot="drop-off-badges" className="flex flex-col gap-inline">
      <h2 className="m-0 text-label text-fg-muted">{tOr('studio.dropOffsTitle', {}, '')}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-inline p-0">
        {moments.map(({ percent, positionSeconds, lostShare }) => (
          <li key={percent}>
            <Badge tone="neutral">
              {tOr(
                'studio.dropOffBadge',
                {
                  time: text(videoDuration(positionSeconds)),
                  share: text({ type: 'percent', value: lostShare * 100 }),
                },
                ''
              )}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
