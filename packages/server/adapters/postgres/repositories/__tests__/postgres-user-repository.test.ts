import { postgresSubject } from '../../../__tests__/contract/subjects';
import { describeUserRepositoryContract } from '../../../__tests__/contract/user-repository.contract';

describeUserRepositoryContract(postgresSubject);
