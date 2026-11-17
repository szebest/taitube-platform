import { describeApiTokenRepositoryContract } from '../../../__tests__/contract/api-token-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeApiTokenRepositoryContract(postgresSubject);
