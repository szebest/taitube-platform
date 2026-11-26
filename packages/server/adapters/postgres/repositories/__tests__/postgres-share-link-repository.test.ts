import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeShareLinkRepositoryContract } from '../../../__tests__/contract/share-link-repository.contract';

describeShareLinkRepositoryContract(postgresSubject);
