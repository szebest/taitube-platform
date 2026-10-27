import { describeCommentReportRepositoryContract } from '../../../__tests__/contract/comment-report-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeCommentReportRepositoryContract(postgresSubject);
