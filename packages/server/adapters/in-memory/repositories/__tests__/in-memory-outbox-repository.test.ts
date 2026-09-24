import { describeOutboxRepositoryContract } from '../../../__tests__/contract/outbox-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';

describeOutboxRepositoryContract(inMemorySubject);
