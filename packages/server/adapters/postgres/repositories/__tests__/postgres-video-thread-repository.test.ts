import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoThreadRepositoryContract } from '../../../__tests__/contract/video-thread-repository.contract';

describeVideoThreadRepositoryContract(postgresSubject);
