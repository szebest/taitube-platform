import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeSearchRepositoryContract } from '../../../__tests__/contract/search-repository.contract';

describeSearchRepositoryContract(postgresSubject);
