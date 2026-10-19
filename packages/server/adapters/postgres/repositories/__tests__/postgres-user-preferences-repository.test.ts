import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeUserPreferencesRepositoryContract } from '../../../__tests__/contract/user-preferences-repository.contract';

describeUserPreferencesRepositoryContract(postgresSubject);
