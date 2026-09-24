import { describeDlqRepositoryContract } from '../../../__tests__/contract/dlq-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/subjects';

describeDlqRepositoryContract(postgresSubject);
