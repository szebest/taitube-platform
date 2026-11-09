import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { ScreenResult } from '@vp/job-contracts';
import { type Result, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export type ScreeningGate = 'proceed' | 'held';

export interface ScreeningGateInput {
  repositories: Pick<Repositories, 'screenings'>;
  videoId: string;
  generation: number;
  /** The flow had a `screen` child, so a missing result is a failure and not an old flow. */
  screened: boolean | undefined;
  screen: ScreenResult | undefined;
  thresholdVersion: string;
}

/**
 * Whether the video may be published. A `HOLD` result, or a screening that left no result because it
 * spent its retries, moves the video to `HELD` before any master is written, so nothing plays. A moderator's
 * approval settles the case, and a flow made without a `screen` child (screening off, or built
 * before it existed) is published as it always was.
 */
export async function screeningGate(
  input: ScreeningGateInput
): Promise<Result<ScreeningGate, DatabaseUnavailable>> {
  const { repositories, videoId, screen } = input;
  if (!input.screened) return ok('proceed');

  const latest = await repositories.screenings.latestForVideo(videoId);
  if (isErr(latest)) return latest;
  if (latest.value?.decision === 'approved' || screen?.outcome === 'PASS') return ok('proceed');

  if (!screen) {
    const recorded = await repositories.screenings.record({
      id: uuidv7(),
      videoId,
      sourceChecksum: `unscreened-g${input.generation}`,
      outcome: 'HOLD',
      score: 1,
      reasons: [
        {
          reason: 'SCREEN_ERROR',
          score: 1,
          evidence: { detail: 'The screening finished no result before its retries ran out' },
        },
      ],
      flags: [],
      modelVersion: null,
      thresholdVersion: input.thresholdVersion,
    });
    if (isErr(recorded)) return recorded;
  }

  const held = await repositories.screenings.hold({ videoId });
  return isErr(held) ? held : ok('held');
}
