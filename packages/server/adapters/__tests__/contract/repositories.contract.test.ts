import { describeCategoryRepositoryContract } from './category-repository.contract';
import { describeChannelRepositoryContract } from './channel-repository.contract';
import { describeDlqRepositoryContract } from './dlq-repository.contract';
import { describeEventRepositoryContract } from './event-repository.contract';
import { describeOutboxRepositoryContract } from './outbox-repository.contract';
import { describeRenditionRepositoryContract } from './rendition-repository.contract';
import { describeStepRepositoryContract } from './step-repository.contract';
import {
  type MakeRepositoriesSubject,
  REPOSITORY_ADAPTERS,
  type RepositoriesSubject,
} from './subjects';
import { describeSubscriptionRepositoryContract } from './subscription-repository.contract';
import { describeUploadRepositoryContract } from './upload-repository.contract';
import { describeUserRepositoryContract } from './user-repository.contract';
import { describeVideoReactionRepositoryContract } from './video-reaction-repository.contract';
import { describeVideoRepositoryContract } from './video-repository.contract';

const SUITES = [
  describeUserRepositoryContract,
  describeChannelRepositoryContract,
  describeCategoryRepositoryContract,
  describeVideoRepositoryContract,
  describeUploadRepositoryContract,
  describeStepRepositoryContract,
  describeRenditionRepositoryContract,
  describeEventRepositoryContract,
  describeOutboxRepositoryContract,
  describeDlqRepositoryContract,
  describeVideoReactionRepositoryContract,
  describeSubscriptionRepositoryContract,
];

for (const { name, makeSubject } of REPOSITORY_ADAPTERS) {
  describe(name, () => {
    let pending: Promise<RepositoriesSubject> | undefined;
    const shared: MakeRepositoriesSubject = () => {
      pending ??= makeSubject();
      return pending;
    };

    afterAll(async () => {
      await (await pending)?.close();
    });

    for (const describeContract of SUITES) {
      describeContract(shared);
    }
  });
}
