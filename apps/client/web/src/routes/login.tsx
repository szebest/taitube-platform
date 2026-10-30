import { createFileRoute } from '@tanstack/react-router';
import { LoginSearchSchema, leaveLoginWhenSignedIn } from '@vp/queries';
import { lazy, Suspense, useState } from 'react';

import { LoginPage } from '#app/features/auth/components/login-page';

const PersonaSwitcher = import.meta.env.DEV
  ? lazy(() =>
      import('@vp/queries/dev-personas').then(({ PersonaSwitcher }) => ({
        default: PersonaSwitcher,
      }))
    )
  : undefined;

export const Route = createFileRoute('/login')({
  validateSearch: LoginSearchSchema,
  beforeLoad: leaveLoginWhenSignedIn,
  head: () => ({ meta: [{ title: 'Sign in - Taitube' }] }),
  component: Login,
});

function Login() {
  const [error, setError] = useState<string>();

  return (
    <LoginPage error={error}>
      {PersonaSwitcher && (
        <Suspense>
          <PersonaSwitcher onAttempt={() => setError(undefined)} onFailed={setError} />
        </Suspense>
      )}
    </LoginPage>
  );
}
