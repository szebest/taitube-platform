import type { VideoRetention } from '@vp/api-contracts';
import { EmptyState, NoResultsIllustration } from '@vp/components';
import { useT } from '@vp/intl-react';

const WIDTH = 100;
const HEIGHT = 40;

export function RetentionChart({ curve }: Pick<VideoRetention, 'curve'>) {
  const { tOr } = useT();
  const peak = Math.max(...curve.map(({ viewers }) => viewers));

  if (peak === 0) {
    return (
      <EmptyState.Root size="section">
        <EmptyState.Illustration>
          <NoResultsIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title>{tOr('studio.retentionEmpty', {}, '')}</EmptyState.Title>
      </EmptyState.Root>
    );
  }

  const points = curve
    .map(({ percent, viewers }) => `${percent},${HEIGHT - (viewers / peak) * HEIGHT}`)
    .join(' ');

  return (
    <figure>
      <svg
        role="img"
        aria-label={tOr('studio.retentionChart', {}, '')}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="tw:h-48 tw:w-full tw:overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="tw:flex tw:justify-between tw:text-body-sm tw:text-fg-muted">
        <span>{tOr('studio.retentionStart', {}, '')}</span>
        <span>{tOr('studio.retentionEnd', {}, '')}</span>
      </figcaption>
    </figure>
  );
}
