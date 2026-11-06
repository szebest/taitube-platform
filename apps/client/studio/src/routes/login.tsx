import { createFileRoute } from '@tanstack/react-router';
import { LoginSearchSchema, leaveLoginWhenSignedIn } from '@vp/queries';
import { Suspense, useState } from 'react';

import { LoginPage } from '#app/features/auth/components/login-page';
import { LazyPersonaSwitcher } from '#app/features/auth/components/persona-switcher.lazy';

export const Route = createFileRoute('/login')({
  validateSearch: LoginSearchSchema,
  beforeLoad: leaveLoginWhenSignedIn,
  head: () => ({ meta: [{ title: 'Sign in - Taitube Studio' }] }),
  component: Login,
});

function Login() {
  const [error, setError] = useState<string>();

  return (
    <LoginPage error={error}>
      {LazyPersonaSwitcher && (
        <Suspense>
          <LazyPersonaSwitcher onAttempt={() => setError(undefined)} onFailed={setError} />
        </Suspense>
      )}
    </LoginPage>
  );
}
