import { Link, useLocation } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Button } from '@vp/ui';

/** A guest's way in from any page: the sign-in page, which brings them back to the page they pressed it on. */
export function SignInButton() {
  const { tOr } = useT();
  const redirect = useLocation({ select: ({ href }) => href });

  return (
    <Button asChild variant="outline">
      <Link to="/login" search={{ redirect }}>
        {tOr('auth.signIn', {}, '')}
      </Link>
    </Button>
  );
}
