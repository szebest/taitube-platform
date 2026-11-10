import { useT } from '@vp/intl-react';
import { Button, Callout } from '@vp/ui';
import { useInstallPrompt } from '#app/features/pwa/hooks/use-install-prompt';

/** The "Install Taitube" callout, floating over the page so that showing it moves nothing, shown once the browser offers an install and until it is dismissed. */
export function InstallPrompt() {
  const { tOr } = useT();
  const { available, install, dismiss } = useInstallPrompt();

  if (!available) {
    return null;
  }

  return (
    <Callout.Root
      role="status"
      className="fixed inset-x-gutter-compact bottom-[calc(3.5rem+env(safe-area-inset-bottom)+var(--gap-stack))] z-pip shadow-3 motion-enter medium:inset-x-auto medium:end-gutter-medium medium:bottom-stack medium:max-w-md"
    >
      <Callout.Icon />
      <Callout.Title>{tOr('pwa.installTitle', {}, '')}</Callout.Title>
      <Callout.Body>{tOr('pwa.installBody', {}, '')}</Callout.Body>
      <Callout.Action>
        <Button size="sm" onClick={install}>
          {tOr('pwa.installAction', {}, '')}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {tOr('pwa.installDismiss', {}, '')}
        </Button>
      </Callout.Action>
    </Callout.Root>
  );
}
