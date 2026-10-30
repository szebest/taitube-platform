import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeSearchHistoryRepositoryContract } from '../../../__tests__/contract/search-history-repository.contract';

describeSearchHistoryRepositoryContract(postgresSubject);
