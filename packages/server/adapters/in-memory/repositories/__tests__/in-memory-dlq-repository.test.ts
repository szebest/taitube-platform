import { describeDlqRepositoryContract } from '../../../__tests__/contract/dlq-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';

describeDlqRepositoryContract(inMemorySubject);
