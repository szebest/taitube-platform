import { describeCommentModerationRepositoryContract } from '../../../__tests__/contract/comment-moderation.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeCommentModerationRepositoryContract(postgresSubject);
