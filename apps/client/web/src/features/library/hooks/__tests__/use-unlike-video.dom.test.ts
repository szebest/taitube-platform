import { setReaction } from '@vp/api-contracts';
import { api } from '@vp/web-testing';

import { libraryVideo, uuid } from '../../__tests__/library-fixtures';
import { likedVideosQueryOptions } from '../../api/library-queries';
import { useUnlikeVideo } from '../use-unlike-video';
import { itChangesTheListOptimistically } from './optimistic-list';

describe('apps/client/web: useUnlikeVideo', () => {
  itChangesTheListOptimistically({
    key: likedVideosQueryOptions(api).queryKey,
    contract: setReaction,
    pages: [[libraryVideo(1), libraryVideo(2)], [libraryVideo(3)]],
    hook: () => useUnlikeVideo(uuid(2)),
    variables: undefined,
    idOf: ({ id }) => id,
    remaining: [uuid(1), uuid(3)],
  });
});
