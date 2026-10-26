import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeRelatedVideosRepositoryContract } from '../../../__tests__/contract/related-videos-repository.contract';

describeRelatedVideosRepositoryContract(postgresSubject);
