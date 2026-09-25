import { Outlet, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { AuthorizedContainer } from '#app/modules/shared/components';

export const Route = createFileRoute('/_authed')({
  validateSearch: z.object({}),
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <AuthorizedContainer>
      <Outlet />
    </AuthorizedContainer>
  );
}
