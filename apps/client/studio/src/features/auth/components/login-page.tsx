import { useSearch } from '@tanstack/react-router';
import { LoginCard } from '@vp/components';
import { useT } from '@vp/intl-react';
import type { ReactNode } from 'react';

export type LoginPageProps = {
  /** A failed sign-in, in the words to show the viewer. */
  error?: string;
  /** The ways this build offers to sign in; none says so. */
  children?: ReactNode;
};

/** `/login`: the card, the line saying the session ended when it did, and the ways to sign in. */
export function LoginPage({ error, children }: LoginPageProps) {
  const { reason } = useSearch({ from: '/login' });
  const { tOr } = useT();

  return (
    <LoginCard.Root>
      <LoginCard.Title>{tOr('studio.signIn', {}, '')}</LoginCard.Title>
      {reason === 'expired' && <LoginCard.Expired>{tOr('auth.expired', {}, '')}</LoginCard.Expired>}
      {error && <LoginCard.Error>{error}</LoginCard.Error>}
      <LoginCard.Body>{children ?? <p>{tOr('auth.noProvider', {}, '')}</p>}</LoginCard.Body>
    </LoginCard.Root>
  );
}
