import { describeChannelAuditRepositoryContract } from '../../../__tests__/contract/channel-audit-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelAuditRepositoryContract(postgresSubject);
