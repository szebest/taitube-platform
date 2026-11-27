import { describeChannelMemberRepositoryContract } from '../../../__tests__/contract/channel-member-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelMemberRepositoryContract(postgresSubject);
