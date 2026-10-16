import { useT } from '@vp/intl-react';
import { type ReactNode, useId } from 'react';

export type LoginPageProps = {
  /** The ways this build offers to sign in; none says so. */
  children?: ReactNode;
};

/** `/login` in either app, in plain markup. */
export function LoginPage({ children }: LoginPageProps) {
  const headingId = useId();
  const { tOr } = useT();

  return (
    <section aria-labelledby={headingId}>
      <h1 id={headingId}>{tOr('auth.signInTitle', {}, '')}</h1>
      {children ?? <p>{tOr('auth.noProvider', {}, '')}</p>}
    </section>
  );
}
