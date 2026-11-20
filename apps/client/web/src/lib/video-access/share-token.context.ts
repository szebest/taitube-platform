import { createContext, useContext } from 'react';

/**
 * The share link's token the video in view was opened with. Every read of that video and its
 * corrections under it sends the token, so a refetch of the shared entry never loses the link.
 */
export const ShareTokenContext = createContext<string | undefined>(undefined);

export function useShareToken(): string | undefined {
  return useContext(ShareTokenContext);
}
