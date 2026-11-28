import { describeContentLinkStatsRepositoryContract } from '../../../__tests__/contract/content-link-stats-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeContentLinkStatsRepositoryContract(postgresSubject);
