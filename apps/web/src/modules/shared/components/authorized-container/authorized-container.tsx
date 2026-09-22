import type { PropsWithChildren } from 'react';

import { Navigate } from 'react-router-dom';

import { useAuth } from '../../providers';

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

export default AuthorizedContainer;
