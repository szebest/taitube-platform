import { Outlet, createFileRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAuth } from '@vp/queries';
import { z } from 'zod';

import { WEB_URL } from '#app/config';

export const Route = createFileRoute('/_authed')({
  ssr: false,
  validateSearch: z.object({}),
  component: AuthedLayout,
});

function AuthedLayout() {
  const { account, isLoading } = useAuth();
  const { tOr } = useT();

  if (isLoading) return null;

  if (!account) {
    return (
      <p role="alert">
        <a href={WEB_URL}>{tOr('studio.signInRequired', {}, '')}</a>
      </p>
    );
  }

  return <Outlet />;
}
