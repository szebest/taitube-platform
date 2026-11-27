import { describePlaylistStatsContract } from '../../../__tests__/contract/playlist-stats-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describePlaylistStatsContract(postgresSubject);
