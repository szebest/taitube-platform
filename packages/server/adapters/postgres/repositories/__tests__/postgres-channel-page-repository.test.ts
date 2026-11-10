import { describeChannelPageRepositoryContract } from '../../../__tests__/contract/channel-page-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelPageRepositoryContract(postgresSubject);
