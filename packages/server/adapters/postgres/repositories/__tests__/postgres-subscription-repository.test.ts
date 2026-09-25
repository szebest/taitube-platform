import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeSubscriptionRepositoryContract } from '../../../__tests__/contract/subscription-repository.contract';

describeSubscriptionRepositoryContract(postgresSubject);
