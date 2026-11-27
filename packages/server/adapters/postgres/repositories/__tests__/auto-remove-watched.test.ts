import { describePlaylistWatchListContract } from '../../../__tests__/contract/playlist-watch-list.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describePlaylistWatchListContract(postgresSubject);
