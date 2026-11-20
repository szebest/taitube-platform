import { useT } from '@kit/intl-react';
import { ContextMenu } from '@kit/ui';
import { type PropsWithChildren, type SyntheticEvent, useState } from 'react';
import { identityPath, parseIdentityPath } from '../account-slots';
import { IdentityEntryRow } from './identity-entry-row';
import { useIdentityChoices } from './use-identity-choices';

/** The path a link on this origin leads to, without the identity prefix it was drawn with. */
function linkedPath(target: EventTarget | null): string | undefined {
  const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!link) return undefined;
  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin) return undefined;
  return `${parseIdentityPath(url.pathname).pathname}${url.search}${url.hash}`;
}

/**
 * Gives every link of this app inside it an "Open as..." context menu listing the identities, each
 * opening the link in a new tab as that identity; anywhere else the browser's own menu stays.
 * In a browser of one identity the menu never opens.
 */
export function OpenAsLinks({ children }: PropsWithChildren) {
  const { tOr } = useT();
  const { entries, targetOf } = useIdentityChoices(false);
  const [path, setPath] = useState<string>();

  const aim = (event: SyntheticEvent) => setPath(linkedPath(event.target));
  const openAs = (index: number) => {
    const entry = entries[index];
    if (!path || !entry) return;
    const { identity, prefixed } = targetOf(entry);
    const url = new URL(path, window.location.origin);
    const pathname = identityPath(prefixed ? identity : undefined, url.pathname);
    window.open(`${pathname}${url.search}${url.hash}`, '_blank', 'noopener');
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        asChild
        disabled={path === undefined || entries.length < 2}
        onPointerDownCapture={aim}
        onFocusCapture={aim}
      >
        <div className="contents">{children}</div>
      </ContextMenu.Trigger>
      <ContextMenu.Content className="min-w-64">
        <ContextMenu.Label>{tOr('accounts.openAs', {}, '')}</ContextMenu.Label>
        {entries.map((entry, index) =>
          entry.expired ? null : (
            <ContextMenu.Item key={entry.key} onSelect={() => openAs(index)}>
              <IdentityEntryRow entry={entry} check={false} />
            </ContextMenu.Item>
          )
        )}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}
