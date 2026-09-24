import { describeStepRepositoryContract } from '../../../__tests__/contract/step-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/subjects';

describeStepRepositoryContract(postgresSubject);
