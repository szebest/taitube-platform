import { StatCard, StatCardSkeleton } from '@kit/components';
import type { FormatValue } from '@kit/intl';
import { Format } from '@kit/intl-react';
import { Badge, Card, Progress, Skeleton, Table, cn } from '@kit/ui';
import {
  CONTROL_VARIANT_ID,
  EXPERIMENT_MIN_IMPRESSIONS,
  type ExperimentStatus,
  type ExperimentVariantId,
} from '@vp/domain';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useT } from '#app/lib/messages';
import {
  ExperimentResultCardContext,
  useExperimentResultCard,
} from './experiment-result-card.context';
import type { ExperimentResultCardExperiment, ExperimentResultCardVariant } from './types';

const perImpression = (seconds: number): FormatValue => ({
  type: 'number',
  value: seconds,
  options: { unit: 'second', unitDisplay: 'short', maximumFractionDigits: 1 },
});

const viewLength = (seconds: number): FormatValue => ({
  type: 'duration',
  value: seconds,
  options: { style: 'words', unitDisplay: 'short' },
});

const share = (ratio: number): FormatValue => ({ type: 'percent', value: ratio * 100 });

const count = (value: number): FormatValue => ({ type: 'number', value });

/** A finished test ended on the variant the creator applied; a stopped one ended without a winner. */
const HAS_WINNER = {
  running: false,
  finished: true,
  stopped: false,
} as const satisfies Record<ExperimentStatus, boolean>;

function useVariantName() {
  const { tOr } = useT();
  return (variant: ExperimentVariantId) =>
    variant === CONTROL_VARIANT_ID
      ? tOr('studio.experimentControl', { variant }, variant)
      : tOr('studio.experimentVariant', { variant }, variant);
}

function Measure({
  value,
  present,
}: {
  value: number | null | undefined;
  present: (value: number) => FormatValue;
}) {
  const { tOr } = useT();
  if (value === null || value === undefined) {
    return <span className="text-fg-muted">{tOr('studio.experimentNoValue', {}, '')}</span>;
  }
  return <Format value={present(value)} />;
}

export interface ExperimentResultCardRootProps extends ComponentPropsWithRef<'article'> {
  experiment: ExperimentResultCardExperiment;
}

/** One test's numbers per variant; the winner is marked only once the creator applied it. */
export function ExperimentResultCardRoot({
  experiment,
  className,
  children,
  ...props
}: ExperimentResultCardRootProps) {
  const variants = experiment.variants.map((variant) => ({
    ...variant,
    result: experiment.results.variants.find(({ variantId }) => variantId === variant.id),
    winner: HAS_WINNER[experiment.status] && experiment.winnerVariantId === variant.id,
  }));

  return (
    <ExperimentResultCardContext value={{ enoughData: experiment.results.enoughData, variants }}>
      <Card.Root asChild>
        <article
          data-slot="experiment-result-card"
          className={cn('flex flex-col gap-stack', className)}
          {...props}
        >
          {children}
        </article>
      </Card.Root>
    </ExperimentResultCardContext>
  );
}

export function ExperimentResultCardHeader(props: ComponentPropsWithRef<'div'>) {
  return <Card.Header data-slot="experiment-result-card-header" {...props} />;
}

/** The headline per variant, or each variant's way to the minimum while the numbers are withheld. */
export function ExperimentResultCardSummary({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { enoughData, variants } = useExperimentResultCard('Summary');
  const { tOr } = useT();
  const nameOf = useVariantName();
  const min = EXPERIMENT_MIN_IMPRESSIONS;

  return (
    <div
      data-slot="experiment-result-card-summary"
      className={cn('flex flex-col gap-stack', className)}
      {...props}
    >
      {!enoughData && (
        <div className="flex flex-col gap-inline">
          <p className="m-0 text-label">{tOr('studio.experimentNotEnoughData', {}, '')}</p>
          <p className="m-0 text-caption text-fg-muted">
            {tOr('studio.experimentNotEnoughDataBody', { min }, '')}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-stack medium:grid-cols-3">
        {variants.map((variant) => {
          const impressions = variant.result?.impressions ?? 0;
          const soFar = tOr('studio.experimentImpressionsSoFar', { count: impressions, min }, '');
          return (
            <StatCard.Root key={variant.id} data-winner={variant.winner || undefined}>
              <StatCard.Label className="flex flex-wrap items-center gap-inline">
                {nameOf(variant.id)}
                {variant.winner && (
                  <Badge size="sm" tone="success">
                    {tOr('studio.experimentWinner', {}, '')}
                  </Badge>
                )}
              </StatCard.Label>
              {enoughData ? (
                <>
                  <StatCard.Value>
                    <Measure
                      value={variant.result?.watchSecondsPerImpression}
                      present={perImpression}
                    />
                  </StatCard.Value>
                  <p className="m-0 text-caption text-fg-muted">
                    {tOr('studio.experimentHeadline', {}, '')}
                  </p>
                </>
              ) : (
                <>
                  <StatCard.Value>
                    <Format value={count(impressions)} />
                  </StatCard.Value>
                  <Progress value={Math.min(impressions, min)} max={min} aria-label={soFar} />
                  <p className="m-0 text-caption text-fg-muted">{soFar}</p>
                </>
              )}
            </StatCard.Root>
          );
        })}
      </div>
    </div>
  );
}

export interface ExperimentResultCardVariantsProps extends Omit<
  ComponentPropsWithRef<'table'>,
  'children'
> {
  /** What a row offers, such as Apply; no column is drawn without it. */
  action?: (variant: ExperimentResultCardVariant) => ReactNode;
}

export function ExperimentResultCardVariants({
  action,
  ...props
}: ExperimentResultCardVariantsProps) {
  const { variants } = useExperimentResultCard('Variants');
  const { tOr } = useT();
  const nameOf = useVariantName();

  return (
    <Table.Root size="sm" data-slot="experiment-result-card-variants" {...props}>
      <Table.Caption className="text-start">
        {tOr('studio.experimentResultsLabel', {}, '')}
      </Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head>{tOr('studio.experimentVariantColumn', {}, '')}</Table.Head>
          <Table.Head>{tOr('studio.experimentShows', {}, '')}</Table.Head>
          <Table.Head align="end">{tOr('studio.experimentImpressions', {}, '')}</Table.Head>
          <Table.Head align="end">{tOr('studio.experimentHeadline', {}, '')}</Table.Head>
          <Table.Head align="end">{tOr('studio.experimentClickThrough', {}, '')}</Table.Head>
          <Table.Head align="end">{tOr('studio.experimentAverageView', {}, '')}</Table.Head>
          {action && <Table.Head align="end">{tOr('studio.experimentActions', {}, '')}</Table.Head>}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {variants.map((variant) => (
          <Table.Row key={variant.id}>
            <Table.Head scope="row">
              <span className="flex flex-wrap items-center gap-inline">
                {nameOf(variant.id)}
                {variant.winner && (
                  <Badge size="sm" tone="success">
                    {tOr('studio.experimentWinner', {}, '')}
                  </Badge>
                )}
              </span>
            </Table.Head>
            <Table.Cell>
              <span className="flex flex-col">
                {variant.title && <span>{variant.title}</span>}
                {variant.thumbnail && (
                  <span className="text-caption text-fg-muted">
                    {tOr('studio.experimentThumbnail', { source: variant.thumbnail.source }, '')}
                  </span>
                )}
              </span>
            </Table.Cell>
            <Table.Cell align="end" className="tabular-nums">
              <Format value={count(variant.result?.impressions ?? 0)} />
            </Table.Cell>
            <Table.Cell align="end" className="tabular-nums">
              <Measure value={variant.result?.watchSecondsPerImpression} present={perImpression} />
            </Table.Cell>
            <Table.Cell align="end" className="tabular-nums">
              <Measure value={variant.result?.clickThrough} present={share} />
            </Table.Cell>
            <Table.Cell align="end" className="tabular-nums">
              <Measure value={variant.result?.averageViewSeconds} present={viewLength} />
            </Table.Cell>
            {action && <Table.Cell align="end">{action(variant)}</Table.Cell>}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export function ExperimentResultCardFooter(props: ComponentPropsWithRef<'div'>) {
  return <Card.Footer data-slot="experiment-result-card-footer" {...props} />;
}

/** The card while its test loads, at the loaded card's layout so nothing shifts. */
export function ExperimentResultCardSkeleton() {
  return (
    <Card.Root
      data-slot="experiment-result-card-skeleton"
      aria-hidden="true"
      className="flex flex-col gap-stack"
    >
      <Skeleton shape="text" radius="xs" className="h-[1.5rem] w-[12rem]" />
      <div className="grid grid-cols-1 gap-stack medium:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <Skeleton radius="xs" className="h-[7rem] w-full" />
    </Card.Root>
  );
}
