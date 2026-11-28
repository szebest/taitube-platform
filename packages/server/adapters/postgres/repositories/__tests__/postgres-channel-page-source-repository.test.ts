import { describeChannelPageSourceContract } from '../../../__tests__/contract/channel-page-source.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelPageSourceContract(postgresSubject);
