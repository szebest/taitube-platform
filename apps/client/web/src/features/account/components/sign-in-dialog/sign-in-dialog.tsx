import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import type { MessageKey } from '@vp/messages';
import { Button } from '@vp/ui';
import type { AccountAction } from '#app/lib/account-action/account-actions';
import { decodeIntent, forgetIntent, rememberIntent } from '#app/lib/account-action/replay-intent';
import { urlModals } from '#app/lib/url-modal/registry';

const { UrlModal, useUrlModal } = urlModals;

/** Naming the key, empty, is how a link leaves the modal behind: `retainUrlModal` keeps it otherwise. */
const LEAVE_MODAL: { modal?: undefined } = { modal: undefined };

const REASONS = {
  like: 'auth.signInLike',
  dislike: 'auth.signInDislike',
  comment: 'auth.signInComment',
  reply: 'auth.signInReply',
  heart: 'auth.signInHeart',
  subscribe: 'auth.signInSubscribe',
  save: 'auth.signInSave',
  playlist: 'auth.signInPlaylist',
  queue: 'auth.signInQueue',
  clip: 'auth.signInClip',
  history: 'auth.signInHistory',
  report: 'auth.signInReport',
  bell: 'auth.signInBell',
  feedback: 'auth.signInFeedback',
} as const satisfies Record<AccountAction, MessageKey>;

/** `?modal=sign-in&reason=`: says why an account is needed, and signs in to come back to the same page. */
export function SignInDialog() {
  const { tOr } = useT();
  const { params } = useUrlModal('sign-in');

  const keepIntent = () => {
    const intent = decodeIntent(params?.intent);
    if (intent) {
      rememberIntent(intent);
    } else {
      forgetIntent();
    }
  };

  return (
    <UrlModal.Root id="sign-in">
      <UrlModal.Content>
        <UrlModal.Title>
          {tOr(params ? REASONS[params.reason] : 'auth.signIn', {}, '')}
        </UrlModal.Title>
        <UrlModal.Description>{tOr('auth.signInBody', {}, '')}</UrlModal.Description>
        <UrlModal.Footer>
          <UrlModal.Close asChild>
            <Button variant="ghost">{tOr('auth.signInDismiss', {}, '')}</Button>
          </UrlModal.Close>
          <Button asChild variant="solid" tone="accent">
            <Link
              to="/login"
              search={{ redirect: params?.redirect, ...LEAVE_MODAL }}
              onClick={keepIntent}
            >
              {tOr('auth.signIn', {}, '')}
            </Link>
          </Button>
        </UrlModal.Footer>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
