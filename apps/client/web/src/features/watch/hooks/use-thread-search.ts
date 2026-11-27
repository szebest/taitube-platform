import { useNavigate } from '@tanstack/react-router';

export const DISCUSSION_TABS = ['comments', 'threads'] as const;

export type DiscussionTab = (typeof DISCUSSION_TABS)[number];

/** Moves the watch URL's `tab` and `thread`, which is what a link to a thread carries; from the player's markers too, which sit above the route. */
export function useThreadSearch(videoId: string) {
  const navigate = useNavigate();

  const update = (next: { tab?: DiscussionTab; thread?: string }) =>
    navigate({
      to: '/watch/$videoId',
      params: { videoId },
      search: (previous) => ({ ...previous, ...next }),
      replace: true,
      resetScroll: false,
    });

  return {
    setTab: (tab: DiscussionTab) => update({ tab }),
    open: (thread: string) => update({ tab: 'threads', thread }),
    close: () => update({ thread: undefined }),
  };
}
