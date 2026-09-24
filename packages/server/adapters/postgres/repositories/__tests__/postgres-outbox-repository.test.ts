import { describeOutboxRepositoryContract } from '../../../__tests__/contract/outbox-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeOutboxRepositoryContract(postgresSubject);
