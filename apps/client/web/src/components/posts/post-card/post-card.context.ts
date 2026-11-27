import { createCompoundContext } from '@kit/ui';

export const [PostCardContext, usePostCard] = createCompoundContext<{
  authorId: string;
}>('PostCard');
