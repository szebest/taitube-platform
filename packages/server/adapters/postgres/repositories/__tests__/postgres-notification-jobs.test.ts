import { describeNotificationJobsContract } from '../../../__tests__/contract/notification-jobs.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeNotificationJobsContract(postgresSubject);
