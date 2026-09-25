import { describeCommentRepositoryContract } from '../../../__tests__/contract/comment-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeCommentRepositoryContract(postgresSubject);
