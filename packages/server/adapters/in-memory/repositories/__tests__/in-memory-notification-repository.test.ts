import { describeNotificationRepositoryContract } from '../../../__tests__/contract/notification-repository.contract';
import { describeNotificationWithdrawalContract } from '../../../__tests__/contract/notification-withdrawal.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';

describeNotificationRepositoryContract(inMemorySubject);
describeNotificationWithdrawalContract(inMemorySubject);
