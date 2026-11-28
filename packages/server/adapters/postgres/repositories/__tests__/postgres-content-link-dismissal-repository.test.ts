import { describeContentLinkDismissalRepositoryContract } from '../../../__tests__/contract/content-link-dismissal-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeContentLinkDismissalRepositoryContract(postgresSubject);
