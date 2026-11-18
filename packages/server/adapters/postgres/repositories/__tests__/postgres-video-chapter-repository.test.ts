import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoChapterRepositoryContract } from '../../../__tests__/contract/video-chapter-repository.contract';

describeVideoChapterRepositoryContract(postgresSubject);
