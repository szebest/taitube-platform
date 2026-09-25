import { describeCommentRepositoryContract } from '../../../__tests__/contract/comment-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';

describeCommentRepositoryContract(inMemorySubject);
