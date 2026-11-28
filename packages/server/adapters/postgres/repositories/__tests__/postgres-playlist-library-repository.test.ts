import { describePlaylistLibraryContract } from '../../../__tests__/contract/playlist-library-repository.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describePlaylistLibraryContract(postgresSubject);
