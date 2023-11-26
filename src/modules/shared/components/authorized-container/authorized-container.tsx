import { PropsWithChildren } from 'react';

import { Navigate } from 'react-router-dom';

import { useAuth } from '../../providers';

export function AuthorizedContainer({ children }: PropsWithChildren) {
  const { user } = useAuth();

  return (
    <>
      {
        user ?
          children :
          <Navigate to="/" replace/>
      }
    </>
  );
}

export default AuthorizedContainer;