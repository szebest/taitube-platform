import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeSubscriptionChannelsContract } from '../../../__tests__/contract/subscription-channels.contract';
import { describeSubscriptionRepositoryContract } from '../../../__tests__/contract/subscription-repository.contract';
import { describeSubscriptionSourceContract } from '../../../__tests__/contract/subscription-source.contract';

describeSubscriptionRepositoryContract(postgresSubject);
describeSubscriptionSourceContract(postgresSubject);
describeSubscriptionChannelsContract(postgresSubject);
