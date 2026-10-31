import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';

/** The toast a list change shows when the server refused it, after the list has rolled back. */
export function useChangeFailed(): (error: unknown) => void {
  const fail = useFailureToast();
  const { tOr } = useT();

  return (error) => fail(tOr('library.changeFailed', {}, ''), error);
}
