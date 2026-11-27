import type { ChannelPostRepositoryPort } from '@vp/core/repositories';
import type { ChannelPostContractContext } from './channel-post-contract-context';
import { describeChannelPostLifecycleContract } from './channel-post-lifecycle.contract';
import { describeChannelPostListingContract } from './channel-post-listing.contract';
import { describeChannelPostWritesContract } from './channel-post-writes.contract';
import { describePostEngagementContract } from './post-engagement.contract';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import { seedSubscriber } from './subscriber-fixtures';

export function describeChannelPostRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelPostRepository contract', () => {
    let subject: RepositoriesSubject;
    let posts: ChannelPostRepositoryPort;
    const ctx: ChannelPostContractContext = {
      get subject() {
        return subject;
      },
      get posts() {
        return posts;
      },
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedSubscriber(subject.repositories);
      posts = subject.repositories.channelPosts;
    });

    describeChannelPostWritesContract(ctx);
    describeChannelPostListingContract(ctx);
    describeChannelPostLifecycleContract(ctx);
    describePostEngagementContract(ctx);
  });
}
