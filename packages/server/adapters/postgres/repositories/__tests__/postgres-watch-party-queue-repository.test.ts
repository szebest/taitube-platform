import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWatchPartyQueueRepositoryContract } from '../../../__tests__/contract/watch-party-queue-repository.contract';

describeWatchPartyQueueRepositoryContract(postgresSubject);
