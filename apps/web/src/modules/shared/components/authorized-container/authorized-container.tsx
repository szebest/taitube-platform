import type { PropsWithChildren } from 'react';

import { Navigate } from '@tanstack/react-router';

import { useAuth } from '#app/modules/shared/providers';

export function AuthorizedContainer({ children }: PropsWithChildren) {
  const { account, isLoading } = useAuth();

  if (isLoading)
    return null;

  return (
    <>
      {
        account ?
          children :
          <Navigate to="/" replace />
      }
    </>
  );
}
