import { useT } from '@vp/intl-react';
import { SignInButton, useAccount, useFailureToast } from '@vp/queries';
import { Button } from '@vp/ui';
import { useRevealContact } from '#app/features/channel/hooks/use-reveal-contact';

/** A signed-in viewer's button that shows the channel's contact email as a `mailto:` link; a guest gets the way to sign in. */
export function ContactReveal({ channelId }: { channelId: string }) {
  const { tOr } = useT();
  const account = useAccount();
  const showFailure = useFailureToast();
  const reveal = useRevealContact(channelId);

  if (reveal.data) {
    return (
      <a href={`mailto:${reveal.data.email}`} className="text-accent-ink focus-ring">
        {reveal.data.email}
      </a>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-wrap items-center gap-inline">
        <span className="text-fg-muted">{tOr('channels.contactSignIn', {}, '')}</span>
        <SignInButton />
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      loading={reveal.isPending}
      onClick={() =>
        reveal.mutate(undefined, {
          onError: (error) => showFailure(tOr('channels.contactFailed', {}, ''), error),
        })
      }
    >
      {tOr('channels.showContact', {}, '')}
    </Button>
  );
}
