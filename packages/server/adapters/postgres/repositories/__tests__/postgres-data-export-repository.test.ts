import { describeDataExportRepositoryContract } from '../../../__tests__/contract/data-export-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeDataExportRepositoryContract(postgresSubject);
