import { describeChannelFeaturedRepositoryContract } from '../../../__tests__/contract/channel-featured-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelFeaturedRepositoryContract(postgresSubject);
