import { describeChannelLayoutScheduleContract } from '../../../__tests__/contract/channel-layout-schedule.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelLayoutScheduleContract(postgresSubject);
