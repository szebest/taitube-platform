import { describeEventRepositoryContract } from '../../../__tests__/contract/event-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';

describeEventRepositoryContract(inMemorySubject);
