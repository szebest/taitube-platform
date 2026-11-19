import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoViewRepositoryContract } from '../../../__tests__/contract/video-view-repository.contract';

describeVideoViewRepositoryContract(postgresSubject);
