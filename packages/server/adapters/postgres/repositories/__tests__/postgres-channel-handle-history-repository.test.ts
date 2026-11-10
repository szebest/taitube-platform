import { describeChannelHandleHistoryRepositoryContract } from '../../../__tests__/contract/channel-handle-history-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeChannelHandleHistoryRepositoryContract(postgresSubject);
