import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWatchPartyMessageRepositoryContract } from '../../../__tests__/contract/watch-party-message-repository.contract';

describeWatchPartyMessageRepositoryContract(postgresSubject);
