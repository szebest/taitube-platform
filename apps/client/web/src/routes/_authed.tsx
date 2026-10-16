import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AuthorizedContainer } from '#app/modules/shared/components';

export const Route = createFileRoute('/_authed')({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <AuthorizedContainer>
      <Outlet />
    </AuthorizedContainer>
  );
}
