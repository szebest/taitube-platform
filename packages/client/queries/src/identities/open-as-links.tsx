import { useT } from '@kit/intl-react';
import { DropdownMenu, lazyComponent } from '@kit/ui';
import { type MouseEvent, type PropsWithChildren, useState } from 'react';
import { identityPath, parseIdentityPath } from '../account-slots';
import type { IdentityEntry } from './identity-entries';
import { useIdentityChoices } from './use-identity-choices';

/** The path a link on this origin leads to, without the identity prefix it was drawn with. */
function linkedPath(target: EventTarget | null): string | undefined {
  const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!link) return undefined;
  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin) return undefined;
  return `${parseIdentityPath(url.pathname).pathname}${url.search}${url.hash}`;
}

const LazyOpenAsItems = lazyComponent(() => import('./open-as-items'), {
  name: 'OpenAsItems',
  pick: (module) => module.OpenAsItems,
});

type Aimed = { path: string; x: number; y: number };

/** Where the menu opens: the pointer, or the link itself when the keyboard asked. */
function aimAt(event: MouseEvent, path: string): Aimed {
  if (event.clientX !== 0 || event.clientY !== 0)
    return { path, x: event.clientX, y: event.clientY };
  const box =
    event.target instanceof Element ? event.target.getBoundingClientRect() : new DOMRect();
  return { path, x: box.left, y: box.bottom };
}

/**
 * Gives every link of this app inside it an "Open as..." context menu listing the identities, each
 * opening the link in a new tab as that identity; anywhere else, and in a browser of one identity,
 * the browser's own menu stays.
 */
export function OpenAsLinks({ children }: PropsWithChildren) {
  const { tOr } = useT();
  const { entries, targetOf } = useIdentityChoices(false);
  const [aimed, setAimed] = useState<Aimed>();

  const onContextMenu = (event: MouseEvent) => {
    const path = entries.length > 1 ? linkedPath(event.target) : undefined;
    if (path === undefined) return;
    event.preventDefault();
    setAimed(aimAt(event, path));
  };
  const openAs = (entry: IdentityEntry) => {
    if (!aimed) return;
    const { identity, prefixed } = targetOf(entry);
    const url = new URL(aimed.path, window.location.origin);
    const pathname = identityPath(prefixed ? identity : undefined, url.pathname);
    window.open(`${pathname}${url.search}${url.hash}`, '_blank', 'noopener');
  };

  return (
    <div className="contents" onContextMenu={onContextMenu}>
      {children}
      <DropdownMenu.Root
        open={aimed !== undefined}
        onOpenChange={(open) => !open && setAimed(undefined)}
      >
        <DropdownMenu.Trigger asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed size-0"
            style={{ left: aimed?.x ?? 0, top: aimed?.y ?? 0 }}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" className="min-w-64">
          <DropdownMenu.Label>{tOr('accounts.openAs', {}, '')}</DropdownMenu.Label>
          <LazyOpenAsItems entries={entries} onOpenAs={openAs} />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}
