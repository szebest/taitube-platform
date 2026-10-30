import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoStudioLibraryContract } from '../../../__tests__/contract/video-studio-library.contract';
import { describeVideoStudioRepositoryContract } from '../../../__tests__/contract/video-studio-repository.contract';

describeVideoStudioRepositoryContract(postgresSubject);
describeVideoStudioLibraryContract(postgresSubject);
