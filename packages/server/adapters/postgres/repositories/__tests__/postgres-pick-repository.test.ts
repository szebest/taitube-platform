import { describePickRepositoryContract } from '../../../__tests__/contract/pick-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describePickRepositoryContract(postgresSubject);
