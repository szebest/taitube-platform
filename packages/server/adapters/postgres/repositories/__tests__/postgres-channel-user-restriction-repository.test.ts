import { describeChannelUserRestrictionRepositoryContract } from '../../../__tests__/contract/channel-user-restriction-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelUserRestrictionRepositoryContract(postgresSubject);
