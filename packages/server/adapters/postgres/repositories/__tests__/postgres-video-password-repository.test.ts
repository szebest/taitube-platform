import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoPasswordRepositoryContract } from '../../../__tests__/contract/video-password-repository.contract';

describeVideoPasswordRepositoryContract(postgresSubject);
