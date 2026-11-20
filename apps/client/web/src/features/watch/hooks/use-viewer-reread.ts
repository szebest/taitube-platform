import { useQueryClient } from '@tanstack/react-query';
import { videoKeys } from '@vp/queries';
import { useEffect } from 'react';

/**
 * A server render reads the video without the tab's viewer key, so it shows the control and counts
 * no share-link open. After hydration the page reads the video once more from the browser, which
 * sends the key: the viewer's variant replaces the control in place, without a fallback, and the
 * open is counted. A page the browser loaded itself already read with the key and reads nothing.
 */
export function useViewerReread(videoId: string, readOnServer: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!readOnServer) return;
    void queryClient.refetchQueries(
      { queryKey: videoKeys.detail(videoId), exact: true },
      { cancelRefetch: false }
    );
  }, [queryClient, videoId, readOnServer]);
}
