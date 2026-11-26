import { EmptyState } from '@kit/components';
import { Badge, type BadgeTone, Button, useToast } from '@kit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExperimentView, Video } from '@vp/api-contracts';
import type { ExperimentStatus, ExperimentVariantId } from '@vp/domain';
import { experimentsQueryOptions, useApi, useFailureToast, videoQueryOptions } from '@vp/queries';
import { useState } from 'react';
import { ExperimentResultCard } from '#app/components/analytics/experiment-result-card';
import { VersionConflictDialog } from '#app/components/dialogs/version-conflict-dialog';
import { isVersionConflict } from '#app/features/videos/api/is-version-conflict';
import {
  applyExperimentMutationOptions,
  stopExperimentMutationOptions,
} from '#app/features/videos/api/video-tool-mutations';
import { useT } from '#app/lib/messages';
import { StartExperimentForm } from '../start-experiment-form/start-experiment-form';

const STATUS_VIEW = {
  running: { tone: 'accent', running: true },
  finished: { tone: 'neutral', running: false },
  stopped: { tone: 'neutral', running: false },
} as const satisfies Record<ExperimentStatus, { tone: BadgeTone; running: boolean }>;

interface Choice {
  experimentId: string;
  variantId: ExperimentVariantId;
}

/** The video's title tests, newest first: start one, read the numbers, stop it or apply a variant. */
export function ExperimentsPanel({ video }: { video: Video }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const showFailure = useFailureToast();
  const { tOr } = useT();
  const experiments = useQuery(experimentsQueryOptions(api, video.id));
  const stop = useMutation(stopExperimentMutationOptions(api, video.id));
  const apply = useMutation(applyExperimentMutationOptions(api, video.id));
  const [conflicting, setConflicting] = useState<Choice | null>(null);

  const items = experiments.data?.items ?? [];
  const running = items.some(({ status }) => STATUS_VIEW[status].running);

  const applyChoice = (choice: Choice, version: number) =>
    apply.mutate(
      { ...choice, version },
      {
        onSuccess: () => toast({ tone: 'success', title: tOr('studio.experimentApplied', {}, '') }),
        onError: (error) => {
          if (isVersionConflict(error)) {
            setConflicting(choice);
            return;
          }
          showFailure(tOr('studio.experimentApplyFailed', {}, ''), error);
        },
      }
    );

  const stopTest = (experiment: ExperimentView) =>
    stop.mutate(experiment.id, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.experimentStopped', {}, '') }),
      onError: (error) => showFailure(tOr('studio.experimentStopFailed', {}, ''), error),
    });

  const latest = () => queryClient.query({ ...videoQueryOptions(api, video.id), staleTime: 0 });

  const reload = async () => {
    await latest();
    setConflicting(null);
  };

  const overwrite = async () => {
    const choice = conflicting;
    const { version } = await latest();
    setConflicting(null);
    if (choice) applyChoice(choice, version);
  };

  const pending = stop.isPending || apply.isPending;

  return (
    <section className="flex flex-col gap-section" aria-labelledby="experiments-title">
      <header className="flex flex-col gap-inline">
        <h2 id="experiments-title">{tOr('studio.experimentsTitle', {}, '')}</h2>
        <p className="m-0 text-fg-muted">{tOr('studio.experimentsDescription', {}, '')}</p>
      </header>
      <StartExperimentForm video={video} running={running} />
      {experiments.isPending && <ExperimentResultCard.Skeleton />}
      {experiments.isError && <p role="alert">{tOr('studio.experimentsLoadFailed', {}, '')}</p>}
      {experiments.isSuccess && items.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.experimentsEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      )}
      {items.length > 0 && (
        <ul
          aria-label={tOr('studio.experimentsListLabel', {}, '')}
          className="m-0 flex list-none flex-col gap-stack p-0"
        >
          {items.map((experiment) => (
            <li key={experiment.id}>
              <ExperimentResultCard.Root
                experiment={experiment}
                aria-labelledby={`experiment-${experiment.id}`}
              >
                <ExperimentResultCard.Header className="flex flex-wrap items-center gap-inline">
                  <h3 id={`experiment-${experiment.id}`} className="m-0">
                    {tOr('studio.experimentHeading', { kind: experiment.kind }, '')}
                  </h3>
                  <Badge size="sm" tone={STATUS_VIEW[experiment.status].tone}>
                    {tOr('studio.experimentStatus', { status: experiment.status }, '')}
                  </Badge>
                  <span className="text-caption text-fg-muted">
                    {tOr('studio.experimentStartedAt', { date: experiment.startedAt }, '')}
                  </span>
                </ExperimentResultCard.Header>
                <ExperimentResultCard.Summary />
                <ExperimentResultCard.Variants
                  action={
                    STATUS_VIEW[experiment.status].running
                      ? (variant) => (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              applyChoice(
                                { experimentId: experiment.id, variantId: variant.id },
                                video.version
                              )
                            }
                          >
                            {tOr('studio.experimentApply', { variant: variant.id }, '')}
                          </Button>
                        )
                      : undefined
                  }
                />
                {STATUS_VIEW[experiment.status].running && (
                  <ExperimentResultCard.Footer>
                    <Button
                      variant="outline"
                      tone="danger"
                      disabled={apply.isPending}
                      loading={stop.isPending}
                      onClick={() => stopTest(experiment)}
                    >
                      {tOr('studio.experimentStop', {}, '')}
                    </Button>
                  </ExperimentResultCard.Footer>
                )}
              </ExperimentResultCard.Root>
            </li>
          ))}
        </ul>
      )}
      <VersionConflictDialog
        open={conflicting !== null}
        onOpenChange={(open) => !open && setConflicting(null)}
        onReload={reload}
        onOverwrite={overwrite}
      />
    </section>
  );
}
