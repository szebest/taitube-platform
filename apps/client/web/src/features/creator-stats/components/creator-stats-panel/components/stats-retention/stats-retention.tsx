import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Button } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { CreatorStats } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl-formats';
import { useApi, videoRetentionQueryOptions } from '@vp/queries';
import { usePlayerSeek } from '#app/components/player/taitube-player';
import { RetentionStrip } from '#app/components/watch/retention-strip';
import { useT } from '#app/lib/messages';

type DropOff = CreatorStats['retention']['dropOffs'][number];

function scrollStageIntoView() {
  document.querySelector('[data-slot="stage"]')?.scrollIntoView?.({ block: 'center' });
}

/** The average view, the curve as a strip and the biggest drop-offs as buttons that play the video from there. */
export function StatsRetention({ videoId, stats }: { videoId: string; stats: CreatorStats }) {
  const api = useApi();
  const { tOr } = useT();
  const { format } = useFormat();
  const { seek } = usePlayerSeek();
  const { data } = useQuery(videoRetentionQueryOptions(api, videoId));
  const { average, dropOffs } = stats.retention;
  const text = (value: Parameters<typeof format>[0]) => unwrapOr(format(value), '');
  const clock = (seconds: number) => text(videoDuration(seconds));
  const started = data?.curve[0]?.viewers ?? 0;
  const values = data && started > 0 ? data.curve.map(({ viewers }) => viewers / started) : [];
  const play = ({ positionSeconds }: DropOff) => {
    seek(positionSeconds);
    scrollStageIntoView();
  };

  if (average === null && dropOffs.length === 0) {
    return (
      <p data-slot="creator-stats-retention" className="m-0 text-label text-fg-muted">
        {tOr('creatorStats.retentionNone', {}, '')}
      </p>
    );
  }

  return (
    <section
      data-slot="creator-stats-retention"
      aria-label={tOr('creatorStats.retentionTitle', {}, '')}
      className="flex flex-col gap-inline"
    >
      {average !== null && (
        <p className="m-0 text-body">
          {tOr(
            'creatorStats.retentionAverage',
            { share: text({ type: 'percent', value: average * 100 }) },
            ''
          )}
        </p>
      )}
      {values.length > 0 && (
        <RetentionStrip.Root values={values}>
          {dropOffs.map((dropOff) => (
            <RetentionStrip.Marker
              key={dropOff.percent}
              percent={dropOff.percent}
              aria-label={tOr(
                'creatorStats.dropOffSeek',
                { time: clock(dropOff.positionSeconds) },
                ''
              )}
              onClick={() => play(dropOff)}
            />
          ))}
        </RetentionStrip.Root>
      )}
      {dropOffs.length > 0 && (
        <div className="flex flex-col gap-inline">
          <h3 className="m-0 text-label text-fg-muted">
            {tOr('creatorStats.dropOffsTitle', {}, '')}
          </h3>
          <ul className="m-0 flex list-none flex-wrap gap-inline p-0">
            {dropOffs.map((dropOff) => (
              <li key={dropOff.percent}>
                <Button variant="soft" size="sm" onClick={() => play(dropOff)}>
                  {tOr(
                    'creatorStats.dropOff',
                    {
                      time: clock(dropOff.positionSeconds),
                      share: text({ type: 'percent', value: dropOff.lostShare * 100 }),
                    },
                    ''
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
