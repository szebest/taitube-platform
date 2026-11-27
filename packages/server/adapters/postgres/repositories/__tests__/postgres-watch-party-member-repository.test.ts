import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWatchPartyMemberRepositoryContract } from '../../../__tests__/contract/watch-party-member-repository.contract';

describeWatchPartyMemberRepositoryContract(postgresSubject);
