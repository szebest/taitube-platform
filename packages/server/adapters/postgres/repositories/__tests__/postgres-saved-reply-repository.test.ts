import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeSavedReplyRepositoryContract } from '../../../__tests__/contract/saved-reply-repository.contract';

describeSavedReplyRepositoryContract(postgresSubject);
