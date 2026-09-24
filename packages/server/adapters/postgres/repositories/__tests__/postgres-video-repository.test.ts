import { postgresSubject } from '../../../__tests__/contract/subjects';
import { describeVideoRepositoryContract } from '../../../__tests__/contract/video-repository.contract';

describeVideoRepositoryContract(postgresSubject);
