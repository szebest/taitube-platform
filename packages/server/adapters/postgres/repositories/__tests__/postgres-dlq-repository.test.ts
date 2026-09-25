import { describeDlqRepositoryContract } from '../../../__tests__/contract/dlq-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeDlqRepositoryContract(postgresSubject);
