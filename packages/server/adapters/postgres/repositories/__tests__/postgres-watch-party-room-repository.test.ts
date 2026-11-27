import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeWatchPartyRoomRepositoryContract } from '../../../__tests__/contract/watch-party-room-repository.contract';

describeWatchPartyRoomRepositoryContract(postgresSubject);
