import { useLocation } from '@tanstack/react-router';
import { useCan } from '@vp/permissions-react';
import { ACCOUNT_ACTION_RULES, type AccountAction } from '#app/lib/account-action/account-actions';
import { encodeIntent, type ReplayIntent } from '#app/lib/account-action/replay-intent';
import { urlModals } from '#app/lib/url-modal/registry';

/**
 * The one answer for an account action: `run` does it for a viewer who may, and opens the sign-in prompt
 * with this action's reason for a guest. `allowed` is for a view that only reads when the viewer may.
 * An idempotent `intent` is replayed once after sign-in.
 */
export function useRequireAccount(action: AccountAction) {
  const [permission, subject] = ACCOUNT_ACTION_RULES[action];
  const allowed = useCan(permission, subject);
  const { open } = urlModals.useUrlModal('sign-in');
  const redirect = useLocation({ select: ({ href }) => href });

  const run = (perform: () => void, intent?: ReplayIntent) => {
    if (allowed) {
      perform();
      return;
    }

    open({
      reason: action,
      redirect,
      intent: intent && encodeIntent(intent),
    });
  };

  return { allowed, run };
}
