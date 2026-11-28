import { describeContentLinkRepositoryContract } from '../../../__tests__/contract/content-link-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeContentLinkRepositoryContract(postgresSubject);
