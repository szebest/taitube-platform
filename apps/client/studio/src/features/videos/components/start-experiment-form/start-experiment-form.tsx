import { useT } from '@kit/intl-react';
import { assertNever, isErr } from '@kit/result';
import { Button, Field, Input, SegmentedControl, useToast } from '@kit/ui';
import { useMutation } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import {
  CONTROL_VARIANT_ID,
  EXPERIMENT_KINDS,
  EXPERIMENT_VARIANT_IDS,
  type ExperimentKind,
  MAX_EXPERIMENT_VARIANTS,
  MIN_EXPERIMENT_VARIANTS,
  thumbnailSourcesOf,
} from '@vp/domain';
import { decideExperiment } from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import { present, useApi, useFailureToast } from '@vp/queries';
import { VIDEO_TITLE_BOUNDS } from '@vp/validation';
import { type FormEvent, useState } from 'react';
import { startExperimentMutationOptions } from '#app/features/videos/api/video-tool-mutations';

const VARIANT_COUNTS = [MIN_EXPERIMENT_VARIANTS, MAX_EXPERIMENT_VARIANTS];

export interface StartExperimentFormProps {
  video: Video;
  /** A test is running on the video already, and a video runs one at a time. */
  running: boolean;
}

/** Two or three titles, the first the current one, checked against the test rule before starting. */
export function StartExperimentForm({ video, running }: StartExperimentFormProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const start = useMutation(startExperimentMutationOptions(useApi(), video.id));
  const [kind, setKind] = useState<ExperimentKind>('title');
  const [count, setCount] = useState(MIN_EXPERIMENT_VARIANTS);
  const [challengers, setChallengers] = useState(['', '']);
  const [problem, setProblem] = useState<string | null>(null);

  const context = { id: video.id, posterKey: video.posterUrl };
  const thumbnails = thumbnailSourcesOf(context).length;
  const thumbnailsUsable = thumbnails >= MIN_EXPERIMENT_VARIANTS;
  const control = video.title ?? '';
  const titles = [control, ...challengers].slice(0, count);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const decided = decideExperiment(
      { kind, variants: titles.map((title) => ({ title })) },
      { video: context, runningOnVideo: running, runningOnChannel: 0 }
    );
    if (isErr(decided)) {
      switch (decided.error.code) {
        case ErrorCodes.VALIDATION_FAILED:
          setProblem(
            decided.error.field === 'title'
              ? tOr(
                  'studio.experimentInvalidTitles',
                  { min: VIDEO_TITLE_BOUNDS.minLength, max: VIDEO_TITLE_BOUNDS.maxLength },
                  ''
                )
              : tOr(present(decided.error).copy, {}, '')
          );
          return;
        case ErrorCodes.EXPERIMENT_LIMIT:
          setProblem(tOr(present(decided.error).copy, {}, ''));
          return;
        default:
          return assertNever(decided.error, 'StartExperimentForm');
      }
    }
    setProblem(null);
    start.mutate(
      {
        kind,
        variants: decided.value.map((variant) => ({
          title: variant.title ?? undefined,
          thumbnail: variant.thumbnail ?? undefined,
        })),
      },
      {
        onSuccess: () => {
          setChallengers(['', '']);
          toast({ tone: 'success', title: tOr('studio.experimentStarted', {}, '') });
        },
        onError: (error) => showFailure(tOr('studio.experimentStartFailed', {}, ''), error),
      }
    );
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="start-experiment-title"
      className="flex flex-col gap-stack"
    >
      <h3 id="start-experiment-title" className="m-0">
        {tOr('studio.experimentStartTitle', {}, '')}
      </h3>
      <div className="flex flex-col gap-inline">
        <span id="experiment-kind-label" className="text-label">
          {tOr('studio.experimentKind', {}, '')}
        </span>
        <SegmentedControl.Root
          aria-labelledby="experiment-kind-label"
          value={kind}
          onValueChange={(next) => {
            const known = EXPERIMENT_KINDS.find((option) => option === next);
            if (known) setKind(known);
          }}
        >
          {EXPERIMENT_KINDS.map((option) => (
            <SegmentedControl.Item
              key={option}
              value={option}
              disabled={option !== 'title' && !thumbnailsUsable}
            >
              {tOr('studio.experimentKindOption', { kind: option }, option)}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
        {!thumbnailsUsable && (
          <p className="m-0 text-caption text-fg-muted">
            {tOr('studio.experimentThumbnailsNeeded', { count: thumbnails }, '')}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-inline">
        <span id="experiment-count-label" className="text-label">
          {tOr('studio.experimentVariantCount', {}, '')}
        </span>
        <SegmentedControl.Root
          aria-labelledby="experiment-count-label"
          value={String(count)}
          onValueChange={(next) => {
            const known = VARIANT_COUNTS.find((option) => String(option) === next);
            if (known) setCount(known);
          }}
        >
          {VARIANT_COUNTS.map((option) => (
            <SegmentedControl.Item key={option} value={String(option)}>
              {tOr('studio.experimentVariantCountOption', { count: option }, String(option))}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </div>
      <Field.Root>
        <Field.Label>
          {tOr('studio.experimentControlTitle', { variant: CONTROL_VARIANT_ID }, '')}
        </Field.Label>
        <Input value={control} readOnly />
        <Field.Hint>{tOr('studio.experimentControlHint', {}, '')}</Field.Hint>
      </Field.Root>
      {EXPERIMENT_VARIANT_IDS.slice(1, count).map((variant, index) => (
        <Field.Root key={variant} invalid={problem !== null}>
          <Field.Label>{tOr('studio.experimentVariantTitle', { variant }, '')}</Field.Label>
          <Input
            value={challengers[index] ?? ''}
            onChange={(event) =>
              setChallengers((current) =>
                current.map((title, at) => (at === index ? event.target.value : title))
              )
            }
          />
        </Field.Root>
      ))}
      {problem && (
        <p role="alert" className="m-0 text-caption text-danger-ink">
          {problem}
        </p>
      )}
      {running && (
        <p className="m-0 text-caption text-fg-muted">
          {tOr('studio.experimentRunningAlready', {}, '')}
        </p>
      )}
      <div>
        <Button
          type="submit"
          variant="solid"
          tone="accent"
          disabled={running}
          loading={start.isPending}
        >
          {tOr('studio.experimentStart', {}, '')}
        </Button>
      </div>
    </form>
  );
}
