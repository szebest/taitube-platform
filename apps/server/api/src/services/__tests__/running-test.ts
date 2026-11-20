import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { type Experiment, type ExperimentVariantId, pickVariant } from '@vp/domain';

export const TEST_ID = '00000000-0000-7000-8000-0000000e0001';

/** A running title test on `videoId` whose control is `control` and whose variant b is `challenger`. */
export async function startTitleTest(
  repositories: InMemoryRepositories,
  { videoId, ownerId, control, challenger, id = TEST_ID }: StartTitleTest
): Promise<Experiment> {
  const experiment: Experiment = {
    id,
    videoId,
    kind: 'title',
    variants: [
      { id: 'a', title: control, thumbnail: null },
      { id: 'b', title: challenger, thumbnail: null },
    ],
    status: 'running',
    startedAt: new Date('2026-11-01T00:00:00.000Z'),
    endedAt: null,
    winnerVariantId: null,
  };
  await repositories.videoExperiments.create(experiment, ownerId, 5);
  return experiment;
}

interface StartTitleTest {
  videoId: string;
  ownerId: string;
  control: string;
  challenger: string;
  id?: string;
}

/** The first session key, in a fixed sequence, that `pickVariant` assigns to `variantId`. */
export function sessionShown(experimentId: string, variantId: ExperimentVariantId): string {
  const variants = [{ id: 'a' as const }, { id: 'b' as const }];
  for (let index = 0; ; index += 1) {
    const key = `session-${String(index).padStart(12, '0')}`;
    if (pickVariant(experimentId, key, variants)?.id === variantId) return key;
  }
}
