import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeRisingVideosRepositoryContract } from '../../../__tests__/contract/rising-videos-repository.contract';

describeRisingVideosRepositoryContract(postgresSubject);
