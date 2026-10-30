import { EmptyState, SectionError } from '@vp/components';
import { cn, Skeleton, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, useId, useState } from 'react';
import { ChartFrameContext, useChartFrame } from './chart-frame.context';
import { chartFrameStyles } from './chart-frame.variants';
import { seriesColor } from './series-color';
import type { ChartFrameSize, ChartFrameStatus, ChartSeries } from './types';

const SKELETON_GRIDLINES = ['top', 'upper', 'middle', 'lower', 'base'];

export type ChartFrameRootProps = ComponentPropsWithRef<'figure'> & {
  size?: ChartFrameSize;
} & ChartFrameStatus;

/**
 * The frame every studio chart sits in: a `figure` named by its `Title` and described by its
 * `Description`, which every chart needs as its text alternative.
 */
export function ChartFrameRoot({
  size = 'md',
  state,
  onRetry,
  className,
  ...props
}: ChartFrameRootProps) {
  const descriptionId = useId();
  const [isolated, setIsolated] = useState<ChartSeries>();

  if (state === 'loading') {
    return <ChartSkeleton size={size} />;
  }

  const toggleIsolated = (series: ChartSeries) =>
    setIsolated((current) => (current === series ? undefined : series));
  const frame = { size, isolated, toggleIsolated, descriptionId };
  const shared =
    state === 'error' ? { ...frame, state, onRetry } : { ...frame, state: state ?? 'ready' };

  return (
    <ChartFrameContext value={shared}>
      <figure
        data-slot="chart-frame"
        data-state={shared.state}
        aria-describedby={descriptionId}
        className={chartFrameStyles({ size }).root({ className })}
        {...props}
      />
    </ChartFrameContext>
  );
}

/** The figure's caption; keep it the first child, so it names the figure. */
export function ChartFrameTitle({ className, ...props }: ComponentPropsWithRef<'figcaption'>) {
  const { size } = useChartFrame('Title');

  return (
    <figcaption
      data-slot="chart-frame-title"
      className={chartFrameStyles({ size }).title({ className })}
      {...props}
    />
  );
}

export function ChartFrameLegend({ className, ...props }: ComponentPropsWithRef<'fieldset'>) {
  const { size } = useChartFrame('Legend');
  const { legend } = useUiCopy();

  return (
    <fieldset
      aria-label={legend}
      data-slot="chart-frame-legend"
      className={chartFrameStyles({ size }).legend({ className })}
      {...props}
    />
  );
}

export interface ChartFrameLegendItemProps extends ComponentPropsWithRef<'button'> {
  series: ChartSeries;
}

/** A toggle that isolates its series; pressing it again shows every series. */
export function ChartFrameLegendItem({
  series,
  className,
  children,
  ...props
}: ChartFrameLegendItemProps) {
  const { size, isolated, toggleIsolated } = useChartFrame('LegendItem');
  const styles = chartFrameStyles({ size });

  return (
    <button
      type="button"
      data-slot="chart-frame-legend-item"
      aria-pressed={isolated === series}
      data-dimmed={isolated !== undefined && isolated !== series ? '' : undefined}
      className={styles.legendItem({ className })}
      onClick={() => toggleIsolated(series)}
      {...props}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className={styles.legendDot()}>
        <circle cx="8" cy="8" r="5" style={{ fill: seriesColor(series) }} />
      </svg>
      {children}
    </button>
  );
}

/** The chart's area at the size's reserved height; empty and error states keep that height. */
export function ChartFramePlot({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  const frame = useChartFrame('Plot');
  const { noDataYet, loadFailed } = useUiCopy();
  const styles = chartFrameStyles({ size: frame.size });

  return (
    <div
      data-slot="chart-frame-plot"
      data-placeholder={frame.state === 'ready' ? undefined : ''}
      className={styles.plot({ className })}
      {...props}
    >
      {frame.state === 'ready' && children}
      {frame.state === 'empty' && (
        <EmptyState.Root size="inline" className="tw:justify-center">
          <EmptyState.Title>{noDataYet}</EmptyState.Title>
        </EmptyState.Root>
      )}
      {frame.state === 'error' && (
        <SectionError.Root layout="block" onRetry={frame.onRetry} className={styles.fill()}>
          <SectionError.Message>{loadFailed}</SectionError.Message>
        </SectionError.Root>
      )}
    </div>
  );
}

/** The text alternative, a summary sentence or a data table, read in place of the drawing. */
export function ChartFrameDescription({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { descriptionId } = useChartFrame('Description');

  return (
    <div
      id={descriptionId}
      data-slot="chart-frame-description"
      className={cn('tw:sr-only', className)}
      {...props}
    />
  );
}

export function ChartSkeleton({ size = 'md' }: { size?: ChartFrameSize }) {
  const styles = chartFrameStyles({ size });

  return (
    <div data-slot="chart-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton shape="text" radius="xs" className="tw:h-[1.375rem] tw:w-[10rem]" />
      <div className={styles.plot({ className: styles.gridlines() })}>
        {SKELETON_GRIDLINES.map((line) => (
          <hr key={line} className={styles.gridline()} />
        ))}
      </div>
    </div>
  );
}
