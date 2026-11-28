import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWatchPartyInterestRepositoryContract } from '../../../__tests__/contract/watch-party-interest-repository.contract';

describeWatchPartyInterestRepositoryContract(postgresSubject);
