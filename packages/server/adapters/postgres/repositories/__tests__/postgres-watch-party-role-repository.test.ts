import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWatchPartyRoleRepositoryContract } from '../../../__tests__/contract/watch-party-role-repository.contract';

describeWatchPartyRoleRepositoryContract(postgresSubject);
