import { describeEntityRevisionRepositoryContract } from '../../../__tests__/contract/entity-revision-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeEntityRevisionRepositoryContract(postgresSubject);
