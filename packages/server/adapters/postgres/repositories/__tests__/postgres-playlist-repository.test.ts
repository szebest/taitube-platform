import { describePlaylistRepositoryContract } from '../../../__tests__/contract/playlist-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describePlaylistRepositoryContract(postgresSubject);
