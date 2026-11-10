import { describeCommentModerationRepositoryContract } from '../../../__tests__/contract/comment-moderation.contract';
import { describeCommentRemovalsContract } from '../../../__tests__/contract/comment-removals.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';

describeCommentModerationRepositoryContract(inMemorySubject);
describeCommentRemovalsContract(inMemorySubject);
