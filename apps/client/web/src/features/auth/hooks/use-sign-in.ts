import { useLocation, useNavigate } from '@tanstack/react-router';

/** Sends a guest to the sign-in page, which brings them back to where they pressed. */
export function useSignIn() {
  const navigate = useNavigate();
  const redirect = useLocation({ select: ({ href }) => href });

  return () => navigate({ to: '/login', search: { redirect } });
}
