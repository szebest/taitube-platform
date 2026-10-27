import { describeNotificationRepositoryContract } from '../../../__tests__/contract/notification-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';

describeNotificationRepositoryContract(inMemorySubject);
