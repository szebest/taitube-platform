import { DropdownMenu } from '@kit/ui';
import { identityPath, parseIdentityPath } from '../account-slots';
import { useT } from '../intl/shared-words';
import type { IdentityEntry } from './identity-entries';
import { IdentityEntryRow } from './identity-entry-row';
import type { SwitchTarget } from './identity-switcher-provider';

export interface OpenAsMenuProps {
  open: boolean;
  x: number;
  y: number;
  /** The link as the page drew it, with the prefix of the identity the tab acts as. */
  href: string;
  entries: readonly IdentityEntry[];
  targetOf: (entry: IdentityEntry) => SwitchTarget;
  onClose: () => void;
}

/** Opens `href`, minus the prefix it was drawn with, in a new tab as the identity `entry` names. */
function openAs(href: string, { identity, prefixed }: SwitchTarget): void {
  const url = new URL(href);
  const { pathname } = parseIdentityPath(url.pathname);
  const prefixedPath = identityPath(prefixed ? identity : undefined, pathname);
  window.open(`${prefixedPath}${url.search}${url.hash}`, '_blank', 'noopener');
}

/** The identities a link can open as, loaded the first time one is asked for; an expired one is left out. */
export function OpenAsMenu({ open, x, y, href, entries, targetOf, onClose }: OpenAsMenuProps) {
  const { tOr } = useT();

  return (
    <DropdownMenu.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DropdownMenu.Trigger asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed size-0"
          style={{ left: x, top: y }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="min-w-64">
        <DropdownMenu.Label>{tOr('accounts.openAs', {}, '')}</DropdownMenu.Label>
        {entries.map((entry) =>
          entry.expired ? null : (
            <DropdownMenu.Item key={entry.key} onSelect={() => openAs(href, targetOf(entry))}>
              <IdentityEntryRow entry={entry} check={false} />
            </DropdownMenu.Item>
          )
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
