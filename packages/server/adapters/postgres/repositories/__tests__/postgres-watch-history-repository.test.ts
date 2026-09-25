import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWatchHistoryRepositoryContract } from '../../../__tests__/contract/watch-history-repository.contract';

describeWatchHistoryRepositoryContract(postgresSubject);
