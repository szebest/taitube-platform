import { Button } from '@kit/ui';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useT } from '#app/lib/messages';

/** In place of a composer for a viewer who is not signed in: the line and the way to sign in. */
export function SignInPrompt() {
  const { tOr } = useT();
  const { run } = useRequireAccount('comment');

  return (
    <div className="flex flex-wrap items-center gap-stack">
      <p className="m-0 text-body">{tOr('watch.discussionSignIn', {}, '')}</p>
      <Button variant="soft" onClick={() => run(() => undefined)}>
        {tOr('auth.signIn', {}, '')}
      </Button>
    </div>
  );
}
