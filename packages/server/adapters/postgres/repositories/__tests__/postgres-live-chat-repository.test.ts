import { describeLiveChatRepositoryContract } from '../../../__tests__/contract/live-chat-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describeLiveChatRepositoryContract(postgresSubject);
