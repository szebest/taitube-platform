import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoRepositoryContract } from '../../../__tests__/contract/video-repository.contract';

describeVideoRepositoryContract(postgresSubject);
