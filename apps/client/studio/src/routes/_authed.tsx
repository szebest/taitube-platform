import { Outlet, createFileRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAuth } from '@vp/queries';

export const Route = createFileRoute('/_authed')({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { account, isLoading } = useAuth();
  const { tOr } = useT();

  if (isLoading) return null;

  if (!account) return <p role="alert">{tOr('studio.devTokenRequired', {}, '')}</p>;

  return <Outlet />;
}
