import { describeFingerprintRepositoryContract } from '../../../__tests__/contract/fingerprint-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeFingerprintRepositoryContract(postgresSubject);
