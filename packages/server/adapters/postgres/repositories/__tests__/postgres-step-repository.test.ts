import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeStepRepositoryContract } from '../../../__tests__/contract/step-repository.contract';

describeStepRepositoryContract(postgresSubject);
