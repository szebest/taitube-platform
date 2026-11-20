import { useT } from '@kit/intl-react';
import { Button } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import type { MessageKey } from '@vp/messages';
import type { AccountAction } from '#app/lib/account-action/account-actions';
import { decodeIntent, forgetIntent, rememberIntent } from '#app/lib/account-action/replay-intent';
import { urlModals } from '#app/lib/url-modal/registry';

const { UrlModal, useUrlModal } = urlModals;

/** Naming the key, empty, is how a link leaves the modal behind: `retainUrlModal` keeps it otherwise. */
const LEAVE_MODAL: { modal?: undefined } = { modal: undefined };

const REASONS = {
  like: 'signInPrompt.like',
  dislike: 'signInPrompt.dislike',
  comment: 'signInPrompt.comment',
  reply: 'signInPrompt.reply',
  heart: 'signInPrompt.heart',
  subscribe: 'signInPrompt.subscribe',
  save: 'signInPrompt.save',
  playlist: 'signInPrompt.playlist',
  queue: 'signInPrompt.queue',
  clip: 'signInPrompt.clip',
  history: 'signInPrompt.history',
  report: 'signInPrompt.report',
  bell: 'signInPrompt.bell',
  feedback: 'signInPrompt.feedback',
} as const satisfies Record<AccountAction, MessageKey>;

/** `?modal=sign-in&reason=`: says why an account is needed, and signs in to come back to the same page. */
export function SignInDialog() {
  const { tOr } = useT();
  const { params } = useUrlModal('sign-in');

  const keepIntent = () => {
    const intent = decodeIntent(params?.intent);
    if (intent && params?.redirect) {
      rememberIntent(intent, params.redirect);
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
        <UrlModal.Description>{tOr('signInPrompt.body', {}, '')}</UrlModal.Description>
        <UrlModal.Footer>
          <UrlModal.Close asChild>
            <Button variant="ghost">{tOr('signInPrompt.dismiss', {}, '')}</Button>
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
