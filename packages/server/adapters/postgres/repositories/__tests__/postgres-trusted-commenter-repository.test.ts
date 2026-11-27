import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeTrustedCommenterRepositoryContract } from '../../../__tests__/contract/trusted-commenter-repository.contract';

describeTrustedCommenterRepositoryContract(postgresSubject);
