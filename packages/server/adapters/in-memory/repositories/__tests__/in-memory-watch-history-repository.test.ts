import { describePlaylistWatchListContract } from '../../../__tests__/contract/playlist-watch-list.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { describeWatchHistoryRepositoryContract } from '../../../__tests__/contract/watch-history-repository.contract';

describeWatchHistoryRepositoryContract(inMemorySubject);
describePlaylistWatchListContract(inMemorySubject);
