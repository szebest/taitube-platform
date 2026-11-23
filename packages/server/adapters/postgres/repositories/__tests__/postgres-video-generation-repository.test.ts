import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoGenerationRepositoryContract } from '../../../__tests__/contract/video-generation-repository.contract';

describeVideoGenerationRepositoryContract(postgresSubject);
