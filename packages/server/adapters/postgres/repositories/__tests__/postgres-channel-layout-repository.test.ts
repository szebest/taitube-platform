import { describeChannelLayoutContract } from '../../../__tests__/contract/channel-layout.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelLayoutContract(postgresSubject);
