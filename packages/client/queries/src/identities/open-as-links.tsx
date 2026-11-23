import { lazyComponent } from '@kit/ui';
import { type MouseEvent, type PropsWithChildren, useState } from 'react';
import { useIdentityChoices } from './use-identity-choices';

/** The address of a link of this app that was right-clicked, or `undefined` for anything else. */
function linkedHref(target: EventTarget | null): string | undefined {
  const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
  return link?.origin === window.location.origin ? link.href : undefined;
}

const LazyOpenAsMenu = lazyComponent(() => import('./open-as-menu'), {
  name: 'OpenAsMenu',
  pick: (module) => module.OpenAsMenu,
});

type Aimed = { href: string; x: number; y: number };

/** Where the menu opens: the pointer, or the link itself when the keyboard asked. */
function aimAt(event: MouseEvent, href: string): Aimed {
  if (event.clientX !== 0 || event.clientY !== 0)
    return { href, x: event.clientX, y: event.clientY };
  const box =
    event.target instanceof Element ? event.target.getBoundingClientRect() : new DOMRect();
  return { href, x: box.left, y: box.bottom };
}

/**
 * Gives every link of this app inside it an "Open as..." context menu listing the identities, each
 * opening the link in a new tab as that identity; anywhere else, and in a browser of one identity,
 * the browser's own menu stays.
 */
export function OpenAsLinks({ children }: PropsWithChildren) {
  const { entries, targetOf } = useIdentityChoices(false);
  const [aimed, setAimed] = useState<Aimed>();
  const [open, setOpen] = useState(false);

  const onContextMenu = (event: MouseEvent) => {
    const href = entries.length > 1 ? linkedHref(event.target) : undefined;
    if (href === undefined) return;
    event.preventDefault();
    setAimed(aimAt(event, href));
    setOpen(true);
  };
  return (
    <div className="contents" onContextMenu={onContextMenu}>
      {children}
      {aimed && (
        <LazyOpenAsMenu
          open={open}
          x={aimed.x}
          y={aimed.y}
          href={aimed.href}
          entries={entries}
          targetOf={targetOf}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
