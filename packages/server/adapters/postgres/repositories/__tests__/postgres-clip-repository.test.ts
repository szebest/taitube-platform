import { describeClipRepositoryContract } from '../../../__tests__/contract/clip-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeClipRepositoryContract(postgresSubject);
