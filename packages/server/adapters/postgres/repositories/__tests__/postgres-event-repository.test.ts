import { describeEventRepositoryContract } from '../../../__tests__/contract/event-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeEventRepositoryContract(postgresSubject);
