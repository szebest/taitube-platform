import { describeCommentSettingsRepositoryContract } from '../../../__tests__/contract/comment-settings-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeCommentSettingsRepositoryContract(postgresSubject);
