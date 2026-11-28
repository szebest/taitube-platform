import { describeContentRefDirectoryContract } from '../../../__tests__/contract/content-ref-directory.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeContentRefDirectoryContract(postgresSubject);
