import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWatchPartyHousekeepingRepositoryContract } from '../../../__tests__/contract/watch-party-housekeeping-repository.contract';

describeWatchPartyHousekeepingRepositoryContract(postgresSubject);
