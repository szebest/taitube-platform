import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { describeSubscriptionChannelsContract } from '../../../__tests__/contract/subscription-channels.contract';
import { describeSubscriptionRepositoryContract } from '../../../__tests__/contract/subscription-repository.contract';
import { describeSubscriptionSourceContract } from '../../../__tests__/contract/subscription-source.contract';

describeSubscriptionRepositoryContract(inMemorySubject);
describeSubscriptionSourceContract(inMemorySubject);
describeSubscriptionChannelsContract(inMemorySubject);
