import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { PostsPage, PostsSearchSchema, prefetchPosts } from '#app/features/posts';

export const Route = createFileRoute('/_authed/posts')({
  validateSearch: PostsSearchSchema,
  loaderDeps: ({ search: { status } }) => ({ status }),
  loader: ({ context, deps: { status } }) => prefetched(prefetchPosts(context, status)),
  component: PostsPage,
});
