import { type Result, err, isErr, ok } from '@kit/result';
import { normalizePlainText, withinLength } from '@kit/validation';
import {
  EXPERIMENT_VARIANT_IDS,
  type ExperimentKind,
  type ExperimentVariant,
  MAX_EXPERIMENT_VARIANTS,
  MAX_RUNNING_EXPERIMENTS_PER_CHANNEL,
  MIN_EXPERIMENT_VARIANTS,
  type ThumbnailSelection,
  type Video,
  thumbnailSourcesOf,
} from '@vp/domain';
import { VIDEO_TITLE_BOUNDS } from '@vp/validation';
import {
  type ExperimentLimit,
  type InvalidExperiment,
  experimentLimit,
  invalidExperiment,
} from './failures';

interface ExperimentVariantInput {
  readonly title?: string | null;
  readonly thumbnail?: ThumbnailSelection | null;
}

export interface ExperimentInput {
  readonly kind: ExperimentKind;
  readonly variants: readonly ExperimentVariantInput[];
}

export interface ExperimentContext {
  readonly video: Pick<Video, 'id' | 'posterKey'>;
  readonly runningOnVideo: boolean;
  readonly runningOnChannel: number;
}

const TESTS_TITLE: Readonly<Record<ExperimentKind, boolean>> = {
  title: true,
  thumbnail: false,
  both: true,
};

function decideTitles(
  variants: readonly ExperimentVariantInput[]
): Result<string[], InvalidExperiment> {
  const titles = variants.map((variant) => normalizePlainText(variant.title ?? ''));
  if (!titles.every((title) => withinLength(title, VIDEO_TITLE_BOUNDS))) {
    return err(
      invalidExperiment(
        'title',
        `Each variant has a title of ${VIDEO_TITLE_BOUNDS.minLength} to ${VIDEO_TITLE_BOUNDS.maxLength} characters`
      )
    );
  }
  return new Set(titles).size === titles.length
    ? ok(titles)
    : err(invalidExperiment('title', 'The variants have different titles'));
}

function decideThumbnails(
  variants: readonly ExperimentVariantInput[],
  video: ExperimentContext['video']
): Result<ThumbnailSelection[], InvalidExperiment> {
  const sources = thumbnailSourcesOf(video);
  if (sources.length < MIN_EXPERIMENT_VARIANTS) {
    return err(invalidExperiment('kind', 'This video has fewer than two thumbnails to compare'));
  }
  const thumbnails = variants.map((variant) => variant.thumbnail ?? null);
  const chosen = thumbnails.filter(
    (thumbnail): thumbnail is ThumbnailSelection =>
      thumbnail !== null && sources.includes(thumbnail.source)
  );
  if (chosen.length !== thumbnails.length) {
    return err(invalidExperiment('thumbnail', 'Each variant uses a thumbnail of this video'));
  }
  return new Set(chosen.map(({ source }) => source)).size === chosen.length
    ? ok(chosen)
    : err(invalidExperiment('thumbnail', 'The variants have different thumbnails'));
}

/**
 * The variants of a new test, lettered from the control `a`. Only the field the kind tests is kept,
 * and the running limits are checked again under the repository's lock.
 */
export function decideExperiment(
  input: ExperimentInput,
  context: ExperimentContext
): Result<ExperimentVariant[], InvalidExperiment | ExperimentLimit> {
  const count = input.variants.length;
  if (count < MIN_EXPERIMENT_VARIANTS || count > MAX_EXPERIMENT_VARIANTS) {
    return err(
      invalidExperiment(
        'variants',
        `A test has ${MIN_EXPERIMENT_VARIANTS} or ${MAX_EXPERIMENT_VARIANTS} variants`
      )
    );
  }

  const titles = TESTS_TITLE[input.kind] ? decideTitles(input.variants) : ok(null);
  if (isErr(titles)) return titles;
  const thumbnails =
    input.kind === 'title' ? ok(null) : decideThumbnails(input.variants, context.video);
  if (isErr(thumbnails)) return thumbnails;

  if (context.runningOnVideo) return err(experimentLimit(context.video.id, 'video'));
  if (context.runningOnChannel >= MAX_RUNNING_EXPERIMENTS_PER_CHANNEL) {
    return err(experimentLimit(context.video.id, 'channel'));
  }

  return ok(
    EXPERIMENT_VARIANT_IDS.slice(0, count).map((id, index) => ({
      id,
      title: titles.value?.[index] ?? null,
      thumbnail: thumbnails.value?.[index] ?? null,
    }))
  );
}
