import { describeChannelRepositoryContract } from '../../../__tests__/contract/channel-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelRepositoryContract(postgresSubject);
