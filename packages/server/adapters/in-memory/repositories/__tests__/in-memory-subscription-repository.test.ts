import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { describeSubscriptionRepositoryContract } from '../../../__tests__/contract/subscription-repository.contract';
import { describeSubscriptionSourceContract } from '../../../__tests__/contract/subscription-source.contract';

describeSubscriptionRepositoryContract(inMemorySubject);
describeSubscriptionSourceContract(inMemorySubject);
