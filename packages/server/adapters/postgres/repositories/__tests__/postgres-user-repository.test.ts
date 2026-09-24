import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeUserRepositoryContract } from '../../../__tests__/contract/user-repository.contract';

describeUserRepositoryContract(postgresSubject);
