import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { describeVideoStudioLibraryContract } from '../../../__tests__/contract/video-studio-library.contract';
import { describeVideoStudioRepositoryContract } from '../../../__tests__/contract/video-studio-repository.contract';

describeVideoStudioRepositoryContract(inMemorySubject);
describeVideoStudioLibraryContract(inMemorySubject);
