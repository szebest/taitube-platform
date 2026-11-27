import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoExperimentRepositoryContract } from '../../../__tests__/contract/video-experiment-repository.contract';

describeVideoExperimentRepositoryContract(postgresSubject);
