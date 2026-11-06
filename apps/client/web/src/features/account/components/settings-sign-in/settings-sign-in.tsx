import { Link, useLocation } from '@tanstack/react-router';
import { EmptyState, SignedOutIllustration } from '@vp/components';
import { useT } from '@vp/intl-react';

/** What a guest sees in place of a section the account holds: one line and a way to sign in. */
export function SettingsSignIn() {
  const { tOr } = useT();
  const href = useLocation({ select: ({ href: current }) => current });

  return (
    <EmptyState.Root size="section">
      <EmptyState.Illustration>
        <SignedOutIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title asChild>
        <h2>{tOr('settings.signInTitle', {}, '')}</h2>
      </EmptyState.Title>
      <EmptyState.Description>{tOr('settings.signInDescription', {}, '')}</EmptyState.Description>
      <EmptyState.Action asChild>
        <Link to="/login" search={{ redirect: href }}>
          {tOr('settings.signIn', {}, '')}
        </Link>
      </EmptyState.Action>
    </EmptyState.Root>
  );
}
