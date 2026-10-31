import { type UseMutationOptions, useMutation } from '@tanstack/react-query';

import { useChangeFailed } from './use-change-failed';

/**
 * `useMutation` for a change to a list, with the failure toast in the options rather than in a
 * `mutate` callback: the optimistic change removes the row that called it, and a callback of a
 * `mutate` call does not run once its component has unmounted.
 */
export function useListMutation<TVariables, TSnapshot>(
  options: UseMutationOptions<unknown, Error, TVariables, TSnapshot>
) {
  const changeFailed = useChangeFailed();

  return useMutation({
    ...options,
    onError: (error, variables, snapshot, context) => {
      options.onError?.(error, variables, snapshot, context);
      changeFailed(error);
    },
  });
}
