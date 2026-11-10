import { describeCommentModerationRepositoryContract } from '../../../__tests__/contract/comment-moderation.contract';
import { describeCommentRemovalsContract } from '../../../__tests__/contract/comment-removals.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeCommentModerationRepositoryContract(postgresSubject);
describeCommentRemovalsContract(postgresSubject);
