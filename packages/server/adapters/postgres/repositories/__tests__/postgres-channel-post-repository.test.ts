import { describeChannelPostRepositoryContract } from '../../../__tests__/contract/channel-post-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelPostRepositoryContract(postgresSubject);
