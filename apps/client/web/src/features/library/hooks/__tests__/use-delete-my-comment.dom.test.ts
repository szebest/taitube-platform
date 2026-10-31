import { deleteComment } from '@vp/api-contracts';
import { api } from '@vp/web-testing';

import { commentItem, uuid } from '#app/features/library/__tests__/library-fixtures';
import { myCommentsQueryOptions } from '#app/features/library/api/library-queries';
import { useDeleteMyComment } from '../use-delete-my-comment';
import { itChangesTheListOptimistically } from './optimistic-list';

describe('apps/client/web: useDeleteMyComment', () => {
  itChangesTheListOptimistically({
    key: myCommentsQueryOptions(api).queryKey,
    contract: deleteComment,
    pages: [[commentItem(1), commentItem(2)], [commentItem(3)]],
    hook: () => useDeleteMyComment(uuid(3002)),
    variables: undefined,
    idOf: ({ id }) => id,
    remaining: [uuid(3001), uuid(3003)],
  });
});
