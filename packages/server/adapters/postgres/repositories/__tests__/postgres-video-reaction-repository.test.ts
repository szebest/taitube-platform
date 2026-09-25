import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoReactionRepositoryContract } from '../../../__tests__/contract/video-reaction-repository.contract';

describeVideoReactionRepositoryContract(postgresSubject);
