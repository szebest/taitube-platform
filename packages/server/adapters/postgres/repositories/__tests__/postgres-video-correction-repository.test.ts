import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeVideoCorrectionRepositoryContract } from '../../../__tests__/contract/video-correction-repository.contract';

describeVideoCorrectionRepositoryContract(postgresSubject);
