import { expectOk } from '@kit/testing/result';
import { ACCESS_DAY, experiment, experimentId } from '../../../__tests__/contract/access-fixtures';
import { OWNER_ID, VIDEO_IDS } from '../../../__tests__/contract/fixtures';
import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { describeVideoExperimentRepositoryContract } from '../../../__tests__/contract/video-experiment-repository.contract';
import { InMemoryVideoExperimentRepository } from '../in-memory-video-experiment-repository';

describeVideoExperimentRepositoryContract(inMemorySubject);

describe('InMemoryVideoExperimentRepository', () => {
  it('clears the tests and the numbers flushed for them', async () => {
    const experiments = new InMemoryVideoExperimentRepository({
      getAllVideos: () => [{ id: VIDEO_IDS.a, ownerId: OWNER_ID }],
    });
    expectOk(await experiments.create(experiment(1), OWNER_ID, 5));
    experiments.addStats([
      {
        experimentId: experimentId(1),
        variantId: 'a',
        viewDate: ACCESS_DAY,
        impressions: 1,
        starts: 0,
        watchSeconds: 0,
      },
    ]);

    experiments.clear();
    expectOk(await experiments.create(experiment(1), OWNER_ID, 5));

    expect(expectOk(await experiments.statsFor([experimentId(1)])).get(experimentId(1))).toEqual(
      []
    );
  });
});
