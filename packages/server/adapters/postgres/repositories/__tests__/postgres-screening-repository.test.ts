import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeScreeningRepositoryContract } from '../../../__tests__/contract/screening-repository.contract';

describeScreeningRepositoryContract(postgresSubject);
