import { describeChannelImageRepositoryContract } from '../../../__tests__/contract/channel-image-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelImageRepositoryContract(postgresSubject);
