import type { ThumbnailSelection, Video } from './video';
import type { ViewDate } from './views';

export const EXPERIMENT_KINDS = ['title', 'thumbnail', 'both'] as const;
export type ExperimentKind = (typeof EXPERIMENT_KINDS)[number];

export const EXPERIMENT_STATUSES = ['running', 'finished', 'stopped'] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

/** `EXPERIMENT` in `@vp/domain-rules` is the machine over these edges: applying a winner finishes a test. */
export const EXPERIMENT_EDGES = {
  apply: { from: ['running'], to: 'finished' },
  stop: { from: ['running'], to: 'stopped' },
} as const satisfies Record<string, { from: readonly ExperimentStatus[]; to: ExperimentStatus }>;

export const EXPERIMENT_VARIANT_IDS = ['a', 'b', 'c'] as const;
export type ExperimentVariantId = (typeof EXPERIMENT_VARIANT_IDS)[number];

/** Variant A is the control: what oEmbed, OpenGraph, the sitemap and a viewer without a session get. */
export const CONTROL_VARIANT_ID: ExperimentVariantId = 'a';

export const MIN_EXPERIMENT_VARIANTS = 2;
export const MAX_EXPERIMENT_VARIANTS = 3;
export const MAX_RUNNING_EXPERIMENTS_PER_CHANNEL = 5;
export const EXPERIMENT_MIN_IMPRESSIONS = 1000;

export interface ExperimentVariant {
  readonly id: ExperimentVariantId;
  readonly title: string | null;
  readonly thumbnail: ThumbnailSelection | null;
}

export interface Experiment {
  readonly id: string;
  readonly videoId: string;
  readonly kind: ExperimentKind;
  readonly variants: readonly ExperimentVariant[];
  readonly status: ExperimentStatus;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly winnerVariantId: ExperimentVariantId | null;
}

/** The thumbnail sources a test may compare; `ThumbnailSelection` has the poster alone today. */
export function thumbnailSourcesOf(
  video: Pick<Video, 'posterKey'>
): ThumbnailSelection['source'][] {
  return video.posterKey ? ['poster'] : [];
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a(text: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * The variant one session sees: `hash(experiment id, session key) mod variants`. Pure and the same
 * in the API and the browser, so the card, the watch page and the beacon agree without a cookie.
 */
export function pickVariant<V extends Pick<ExperimentVariant, 'id'>>(
  experimentId: string,
  sessionKey: string,
  variants: readonly V[]
): V | undefined {
  if (variants.length === 0) return undefined;
  return variants[fnv1a(`${experimentId}:${sessionKey}`) % variants.length];
}

export interface ExperimentVariantStats {
  readonly variantId: ExperimentVariantId;
  readonly impressions: number;
  readonly starts: number;
  readonly watchSeconds: number;
}

interface ExperimentVariantResult extends ExperimentVariantStats {
  /** Null until every variant has the minimum impressions, as are the two ratios beside it. */
  readonly watchSecondsPerImpression: number | null;
  readonly clickThrough: number | null;
  readonly averageViewSeconds: number | null;
}

export interface ExperimentResults {
  readonly enoughData: boolean;
  readonly variants: readonly ExperimentVariantResult[];
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** The numbers the creator decides on; below the minimum every ratio is withheld, never rounded. */
export function experimentResults(
  variants: readonly Pick<ExperimentVariant, 'id'>[],
  stats: readonly ExperimentVariantStats[]
): ExperimentResults {
  const totals = variants.map(({ id }) => {
    const rows = stats.filter((row) => row.variantId === id);
    return {
      variantId: id,
      impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
      starts: rows.reduce((sum, row) => sum + row.starts, 0),
      watchSeconds: rows.reduce((sum, row) => sum + row.watchSeconds, 0),
    };
  });
  const enoughData =
    totals.length > 0 &&
    totals.every(({ impressions }) => impressions >= EXPERIMENT_MIN_IMPRESSIONS);

  return {
    enoughData,
    variants: totals.map((total) => ({
      ...total,
      watchSecondsPerImpression: enoughData ? ratio(total.watchSeconds, total.impressions) : null,
      clickThrough: enoughData ? ratio(total.starts, total.impressions) : null,
      averageViewSeconds: enoughData ? ratio(total.watchSeconds, total.starts) : null,
    })),
  };
}

export type ExperimentMeasure = 'impressions' | 'starts';

/** One variant's numbers for one day, as a flush adds them to `video_experiment_stats`. */
export interface ExperimentCount extends ExperimentVariantStats {
  readonly experimentId: string;
  readonly viewDate: ViewDate;
}

/** Adds the counts of the same variant and day together, so a batch writes one row each. */
export function mergeExperimentCounts(counts: readonly ExperimentCount[]): ExperimentCount[] {
  const merged = new Map<string, ExperimentCount>();
  for (const count of counts) {
    const key = `${count.experimentId}|${count.variantId}|${count.viewDate}`;
    const held = merged.get(key);
    merged.set(
      key,
      held
        ? {
            ...held,
            impressions: held.impressions + count.impressions,
            starts: held.starts + count.starts,
            watchSeconds: held.watchSeconds + count.watchSeconds,
          }
        : count
    );
  }
  return [...merged.values()];
}
