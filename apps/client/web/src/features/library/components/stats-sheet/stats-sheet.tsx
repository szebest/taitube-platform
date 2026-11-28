import { StatCard } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Dialog, SegmentedControl } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { PlaylistView } from '@vp/api-contracts';
import { PLAYLIST_MEASURES, PLAYLIST_STATS_RANGES } from '@vp/domain';
import { useApi } from '@vp/queries';
import { playlistStatsQueryOptions } from '#app/features/library/api/playlist-queries';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

const DEFAULT_RANGE = '30d';

export interface StatsSheetProps {
  playlist: PlaylistView;
}

/** `?modal=playlist-stats&range=`: the owner's opens, plays, follows and forks, and the most played videos. */
export function StatsSheet({ playlist }: StatsSheetProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const navigate = useNavigate({ from: '/playlist' });
  const { isOpen, params, close } = urlModals.useUrlModal('playlist-stats');
  const range = params?.range ?? DEFAULT_RANGE;
  const stats = useQuery({
    ...playlistStatsQueryOptions(useApi(), playlist.id, range),
    enabled: isOpen,
  });

  const count = (value: number) => unwrapOr(format({ type: 'number', value }), '');

  return (
    <Dialog.Root open={isOpen} onOpenChange={(next) => !next && close()}>
      <Dialog.Content side="inline-end" size="md">
        <Dialog.Header>
          <Dialog.Title>{tOr('playlistTools.statsTitle', {}, '')}</Dialog.Title>
          <Dialog.Description>{tOr('playlistTools.statsDescription', {}, '')}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-section">
          <SegmentedControl.Root
            aria-label={tOr('playlistTools.rangeLabel', {}, '')}
            value={range}
            onValueChange={(next) => {
              const picked = PLAYLIST_STATS_RANGES.find((option) => option === next);
              if (picked) {
                void navigate({
                  to: '.',
                  search: (prev) => ({ ...prev, range: picked }),
                  replace: true,
                });
              }
            }}
          >
            {PLAYLIST_STATS_RANGES.map((option) => (
              <SegmentedControl.Item key={option} value={option}>
                {tOr('playlistTools.range', { range: option }, '')}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
          <div className="grid grid-cols-2 gap-stack">
            {PLAYLIST_MEASURES.map((metric) =>
              stats.isError ? (
                <StatCard.Root key={metric} state="error" onRetry={() => void stats.refetch()}>
                  <StatCard.Label>{tOr('playlistTools.measure', { metric }, '')}</StatCard.Label>
                  <StatCard.Value />
                </StatCard.Root>
              ) : (
                <StatCard.Root key={metric} state={stats.isSuccess ? 'ready' : 'loading'}>
                  <StatCard.Label>{tOr('playlistTools.measure', { metric }, '')}</StatCard.Label>
                  <StatCard.Value>{stats.data && count(stats.data[metric])}</StatCard.Value>
                </StatCard.Root>
              )
            )}
          </div>
          <section className="flex flex-col gap-inline" aria-labelledby="playlist-top-items">
            <h3 id="playlist-top-items" className="m-0 text-title">
              {tOr('playlistTools.topTitle', {}, '')}
            </h3>
            {stats.isSuccess && stats.data.topItems.length === 0 && (
              <p className="m-0 text-body-sm text-fg-muted">
                {tOr('playlistTools.topEmpty', {}, '')}
              </p>
            )}
            {stats.isSuccess && stats.data.topItems.length > 0 && (
              <ol className="m-0 flex flex-col gap-2 ps-5">
                {stats.data.topItems.map(({ videoId, title, plays }) => (
                  <li key={videoId} className="text-body-sm">
                    <span className="flex min-w-0 justify-between gap-inline">
                      <span className="truncate">{title}</span>
                      <span className="shrink-0 tabular-nums text-fg-muted">
                        {tOr('playlistTools.plays', { count: plays }, '')}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
