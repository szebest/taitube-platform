import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeSmartPlaylistContract } from '../../../__tests__/contract/smart-playlist-repository.contract';

describeSmartPlaylistContract(postgresSubject);
