import { describeChannelInviteRepositoryContract } from '../../../__tests__/contract/channel-invite-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelInviteRepositoryContract(postgresSubject);
