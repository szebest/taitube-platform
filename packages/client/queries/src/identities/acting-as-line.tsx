import { ActingAs } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Button, Callout } from '@kit/ui';
import { useT } from '../intl/shared-words';
import { useIdentitySwitcher } from './identity-switcher-provider';
import { useIdentityChoices } from './use-identity-choices';
import type { IdentityGuard } from './use-identity-guard';

const ACTION_WORDS = {
  comment: 'accounts.commentingAs',
  reply: 'accounts.replyingAs',
  subscribe: 'accounts.subscribingAs',
} as const;

export interface ActingAsLineProps {
  /** What the composer sends, which the line names. */
  action: keyof typeof ACTION_WORDS;
  guard: IdentityGuard;
}

/**
 * Above a composer that writes as a channel: the identity the write goes out as, with a Switch that
 * opens the switcher, or, once a write was held because the identity changed, the notice and a way
 * to send it anyway. A browser of one account and one channel draws nothing.
 */
export function ActingAsLine({ action, guard }: ActingAsLineProps) {
  const { tOr } = useT();
  const { show } = useIdentitySwitcher();
  const { entries, current } = useIdentityChoices(false);
  const { format } = useFormat();

  if (guard.changed) {
    return (
      <Callout.Root tone="warning" role="alert">
        <Callout.Icon />
        <Callout.Title>{tOr('accounts.identityChanged', {}, '')}</Callout.Title>
        <Callout.Action>
          <Button variant="solid" size="sm" onClick={guard.sendAnyway}>
            {tOr('accounts.sendAnyway', {}, '')}
          </Button>
        </Callout.Action>
      </Callout.Root>
    );
  }
  if (!current || entries.length < 2) return null;

  return (
    <ActingAs.Root>
      <ActingAs.Avatar
        initials={unwrapOr(format({ type: 'initials', value: current.name }), '')}
        imageUrl={current.avatarUrl}
        accent={current.accent}
      />
      <ActingAs.Label>{tOr(ACTION_WORDS[action], { name: current.name }, '')}</ActingAs.Label>
      <ActingAs.Switch onClick={() => show('switcher')}>
        {tOr('accounts.switch', {}, '')}
      </ActingAs.Switch>
    </ActingAs.Root>
  );
}
