import { describePlaylistCollaborationContract } from '../../../__tests__/contract/playlist-collaboration.contract';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';

describePlaylistCollaborationContract(postgresSubject);
