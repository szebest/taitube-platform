import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeUserEventRepositoryContract } from '../../../__tests__/contract/user-event-repository.contract';

describeUserEventRepositoryContract(postgresSubject);
