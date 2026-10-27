import { SectionError } from '@vp/components';
import { Badge, Card, type CardRootProps, Icon, Skeleton, useUiCopy } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  cloneElement,
  isValidElement,
  type PropsWithChildren,
} from 'react';
import { seriesColor } from '../chart-frame';
import { StatCardContext, useStatCard } from './stat-card.context';
import { STAT_CARD_TREND_TONE, statCardStyles } from './stat-card.variants';
import type { StatCardSeries, StatCardSize, StatCardStatus, StatCardTrend } from './types';

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 32;

const TREND_GLYPH = {
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  flat: 'M5 12h14',
} as const satisfies Record<StatCardTrend, string>;

export type StatCardRootProps = Omit<CardRootProps, 'variant' | 'elevation' | 'size'> & {
  size?: StatCardSize;
  /** Renders its one child, a router `Link` to the metric, as the card with a chevron. */
  asChild?: boolean;
} & StatCardStatus;

/** One KPI as a `figure` captioned by its `Label`; the number and the delta arrive formatted. */
export function StatCardRoot({
  size = 'md',
  state,
  onRetry,
  asChild = false,
  className,
  children,
  ...props
}: StatCardRootProps) {
  if (state === 'loading') {
    return <StatCardSkeleton size={size} />;
  }

  const shared = state === 'error' ? { size, state, onRetry } : { size, state: state ?? 'ready' };
  const styles = statCardStyles({ size });
  const card =
    asChild && isValidElement<PropsWithChildren>(children) ? (
      cloneElement(
        children,
        undefined,
        <figure className={styles.figure()}>{children.props.children}</figure>,
        <Icon name="chevron-right" size="md" className={styles.chevron()} />
      )
    ) : (
      <figure className="tw:m-0">{children}</figure>
    );

  return (
    <StatCardContext value={shared}>
      <Card.Root
        asChild
        data-slot="stat-card"
        data-state={shared.state}
        className={styles.root({ className })}
        {...props}
      >
        {card}
      </Card.Root>
    </StatCardContext>
  );
}

export function StatCardLabel({ className, ...props }: ComponentPropsWithRef<'figcaption'>) {
  const { size } = useStatCard('Label');

  return (
    <figcaption
      data-slot="stat-card-label"
      className={statCardStyles({ size }).label({ className })}
      {...props}
    />
  );
}

/** The formatted number; in the empty state a placeholder, in the error state a retry bar. */
export function StatCardValue({ className, children, ...props }: ComponentPropsWithRef<'p'>) {
  const card = useStatCard('Value');
  const { noDataYet, loadFailed } = useUiCopy();
  const styles = statCardStyles({ size: card.size });

  if (card.state === 'error') {
    return (
      <SectionError.Root layout="bar" onRetry={card.onRetry}>
        <SectionError.Message>{loadFailed}</SectionError.Message>
      </SectionError.Root>
    );
  }

  return (
    <p
      data-slot="stat-card-value"
      className={
        card.state === 'empty' ? styles.placeholder({ className }) : styles.value({ className })
      }
      {...props}
    >
      {card.state === 'empty' ? noDataYet : children}
    </p>
  );
}

export interface StatCardDeltaProps extends ComponentPropsWithRef<'span'> {
  trend: StatCardTrend;
}

/** The change, its sign in the text; the arrow and the tone follow `trend`. */
export function StatCardDelta({ trend, className, children, ...props }: StatCardDeltaProps) {
  const { size, state } = useStatCard('Delta');

  if (state !== 'ready') {
    return null;
  }

  return (
    <Badge
      data-slot="stat-card-delta"
      data-trend={trend}
      variant="soft"
      size="sm"
      tone={STAT_CARD_TREND_TONE[trend]}
      className={statCardStyles({ size }).delta({ className })}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={TREND_GLYPH[trend]} />
      </svg>
      {children}
    </Badge>
  );
}

export interface StatCardSparkProps extends Omit<ComponentPropsWithRef<'svg'>, 'values'> {
  values: number[];
  series?: StatCardSeries;
}

/** The trend line, decorative: the delta's text says what it shows. */
export function StatCardSpark({ values, series = 0, className, ...props }: StatCardSparkProps) {
  const { size, state } = useStatCard('Spark');

  if (state !== 'ready' || values.length < 2) {
    return null;
  }

  const low = Math.min(...values);
  const range = Math.max(...values) - low;
  const step = SPARK_WIDTH / (values.length - 1);
  const points = values
    .map((value, index) => {
      const share = range === 0 ? 0.5 : (value - low) / range;
      return `${index * step},${SPARK_HEIGHT - share * SPARK_HEIGHT}`;
    })
    .join(' ');

  return (
    <svg
      data-slot="stat-card-spark"
      aria-hidden="true"
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      className={statCardStyles({ size }).spark({ className })}
      {...props}
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ stroke: seriesColor(series) }}
      />
    </svg>
  );
}

export function StatCardSkeleton({ size = 'md' }: { size?: StatCardSize }) {
  const styles = statCardStyles({ size });

  return (
    <Card.Root data-slot="stat-card-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton shape="text" radius="xs" className="tw:h-[1rem] tw:w-[6rem]" />
      <Skeleton shape="text" radius="xs" className={styles.value({ className: 'tw:w-[7.5rem]' })}>
        &nbsp;
      </Skeleton>
      <Skeleton radius="xs" className="tw:h-[1.25rem] tw:w-[4rem]" />
      <Skeleton radius="xs" className={styles.spark()} />
    </Card.Root>
  );
}
