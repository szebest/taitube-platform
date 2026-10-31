import { useT } from '@vp/intl-react';
import { Button, Callout } from '@vp/ui';
import { useInstallPrompt } from './use-install-prompt';

/** The "Install Taitube" callout, shown once the browser offers an install and until it is dismissed. */
export function InstallPrompt() {
  const { tOr } = useT();
  const { available, install, dismiss } = useInstallPrompt();

  if (!available) {
    return null;
  }

  return (
    <Callout.Root role="status" className="tw:mb-4">
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
