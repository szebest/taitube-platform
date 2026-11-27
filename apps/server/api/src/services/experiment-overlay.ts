import { assertNever, unwrapOr } from '@kit/result';
import type { VideoExperimentRepository } from '@vp/core/repositories';
import { type Experiment, type ThumbnailSelection, pickVariant } from '@vp/domain';
import type { ExperimentTag } from './video-views';

/** What a test changes on a card or a watch read, and the tag it leaves for the beacon. */
export interface ExperimentCard {
  readonly id: string;
  readonly title: string | null;
  readonly posterUrl?: string;
  readonly thumbnailUrl?: string;
  readonly experiment?: ExperimentTag;
}

function thumbnailOf(card: ExperimentCard, selection: ThumbnailSelection): string | undefined {
  switch (selection.source) {
    case 'poster':
      return card.posterUrl;
    default:
      return assertNever(selection.source, 'ThumbnailSelection');
  }
}

function withVariant<T extends ExperimentCard>(
  card: T,
  experiment: Experiment,
  sessionKey: string
): T {
  const variant = pickVariant(experiment.id, sessionKey, experiment.variants);
  if (!variant) return card;
  return {
    ...card,
    title: variant.title ?? card.title,
    thumbnailUrl: variant.thumbnail ? thumbnailOf(card, variant.thumbnail) : card.thumbnailUrl,
    experiment: { id: experiment.id, variantId: variant.id },
  };
}

/**
 * The one step that shows a session its test variants, run after every cache so a cached page holds
 * the control alone. Without a session key nothing changes and nothing is tagged, and a lookup that
 * fails serves the control: it costs the test a sample, never the page.
 */
export class ExperimentOverlay {
  constructor(private readonly experiments: VideoExperimentRepository) {}

  async apply<T extends ExperimentCard>(
    cards: readonly T[],
    sessionKey: string | null
  ): Promise<T[]> {
    if (sessionKey === null || cards.length === 0) return [...cards];

    const running = unwrapOr(
      await this.experiments.runningFor([...new Set(cards.map((card) => card.id))]),
      new Map<string, Experiment>()
    );
    return cards.map((card) => {
      const experiment = running.get(card.id);
      return experiment ? withVariant(card, experiment, sessionKey) : card;
    });
  }

  async applyOne<T extends ExperimentCard>(card: T, sessionKey: string | null): Promise<T> {
    const [applied = card] = await this.apply([card], sessionKey);
    return applied;
  }
}
