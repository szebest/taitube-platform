import { describeAccountAuditRepositoryContract } from '../../../__tests__/contract/account-audit-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeAccountAuditRepositoryContract(postgresSubject);
