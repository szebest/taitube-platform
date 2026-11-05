import { describeLiveStreamRepositoryContract } from '../../../__tests__/contract/live-stream-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';

describeLiveStreamRepositoryContract(inMemorySubject);
