import { Icon, type IconId, Slot, Tooltip } from '@vp/ui';
import { type ComponentPropsWithRef, type SyntheticEvent, use, useState } from 'react';
import { RailLabelsShown } from './app-shell.context';
import { appShellStyles } from './app-shell.variants';

export interface AppShellItemProps extends ComponentPropsWithRef<'a'> {
  icon: IconId;
  /** Marks the page the item leads to: `aria-current="page"` and the accent ground. */
  active?: boolean;
  /** Takes the link the caller passes, a router `Link`, and draws the item's icon and ground on it. */
  asChild?: boolean;
}

function NavLinkContent({
  icon,
  active,
  asChild,
  className,
  children,
  ...props
}: AppShellItemProps & { className: string | undefined }) {
  const Element = asChild ? Slot.Root : 'a';

  return (
    <Element aria-current={active ? 'page' : undefined} className={className} {...props}>
      <Icon name={icon} size="md" className="tw:shrink-0" />
      <Slot.Slottable>{children}</Slot.Slottable>
    </Element>
  );
}

export interface AppShellRailItemProps extends AppShellItemProps {
  /** Only where the rail shows labels: the open rail and the drawer. */
  labelled?: boolean;
}

/** A rail item: where the rail shows icons alone, its name is visually hidden and a tooltip shows it. */
export function AppShellItem({ labelled = false, className, ...props }: AppShellRailItemProps) {
  const labelsShown = use(RailLabelsShown);
  const [tip, setTip] = useState('');
  const [tipOpen, setTipOpen] = useState(false);
  const styles = appShellStyles({ labelled });

  const readName = (event: SyntheticEvent<HTMLLIElement>) =>
    setTip(event.currentTarget.textContent ?? '');

  return (
    <li
      data-slot="app-shell-item"
      className={styles.item()}
      onPointerEnter={readName}
      onFocus={readName}
    >
      <Tooltip.Root open={tipOpen && !labelsShown} onOpenChange={setTipOpen}>
        <Tooltip.Trigger asChild>
          <NavLinkContent className={styles.link({ className })} {...props} />
        </Tooltip.Trigger>
        <Tooltip.Content side="inline-end">{tip}</Tooltip.Content>
      </Tooltip.Root>
    </li>
  );
}

/** An item's name: visually hidden where the rail shows icons alone, so the tooltip is never the only name. */
export function AppShellLabel({ className, ...props }: ComponentPropsWithRef<'span'>) {
  const styles = appShellStyles();

  return <span data-slot="app-shell-label" className={styles.label({ className })} {...props} />;
}

export function AppShellTabItem({ className, ...props }: AppShellItemProps) {
  const styles = appShellStyles();

  return (
    <li data-slot="app-shell-tab-item" className={styles.item()}>
      <NavLinkContent className={styles.tabLink({ className })} {...props} />
    </li>
  );
}
