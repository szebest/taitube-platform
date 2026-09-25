import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoStudioRepositoryContract } from '../../../__tests__/contract/video-studio-repository.contract';

describeVideoStudioRepositoryContract(postgresSubject);
