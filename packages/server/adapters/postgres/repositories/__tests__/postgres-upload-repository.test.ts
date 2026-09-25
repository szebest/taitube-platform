import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeUploadRepositoryContract } from '../../../__tests__/contract/upload-repository.contract';

describeUploadRepositoryContract(postgresSubject);
