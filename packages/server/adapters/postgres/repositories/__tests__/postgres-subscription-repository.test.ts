import { postgresSubject } from '../../../__tests__/contract/subjects';
import { describeSubscriptionRepositoryContract } from '../../../__tests__/contract/subscription-repository.contract';

describeSubscriptionRepositoryContract(postgresSubject);
