import { renderRoute } from '@vp/web-testing/dom';
import { loaderApi } from '#app/__tests__/loader-api';
import { type PostsApi, postsApi } from '#app/__tests__/posts-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

interface PostsViewer {
  /** Signed in unless said otherwise. */
  guest?: boolean;
}

/** Opens `url` in the app with the posts API behind it, for a signed-in viewer or a guest. */
export function renderPosts(url: string, { guest = false, ...api }: PostsApi & PostsViewer = {}) {
  return renderRoute(getRouter, url, {
    handlers: [...(guest ? [] : [signInBrowser()]), ...postsApi(api), ...loaderApi()],
  });
}
