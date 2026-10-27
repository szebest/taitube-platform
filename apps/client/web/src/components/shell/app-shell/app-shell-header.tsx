import { Icon, IconButton, Kbd, useUiCopy } from '@vp/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { appShellStyles } from './app-shell.variants';
import { useHasScrolled } from './use-has-scrolled';
import { useMenuTarget } from './use-menu-target';

export interface AppShellHeaderProps extends Omit<ComponentPropsWithRef<'header'>, 'children'> {
  logo: ReactNode;
  search?: ReactNode;
  actions?: ReactNode;
  account?: ReactNode;
}

/** The menu button, the mark, the search, then the actions and the account at the end; a divider once the page scrolls. */
export function AppShellHeader({
  logo,
  search,
  actions,
  account,
  className,
  ...props
}: AppShellHeaderProps) {
  const { menu } = useUiCopy();
  const target = useMenuTarget();
  const scrolled = useHasScrolled();
  const styles = appShellStyles();

  return (
    <header
      data-slot="app-shell-header"
      data-scrolled={scrolled ? '' : undefined}
      className={styles.header({ className })}
      {...props}
    >
      <div className={styles.headerStart()}>
        <IconButton
          aria-label={menu}
          aria-controls={target.controls}
          aria-expanded={target.expanded}
          onClick={target.toggle}
        >
          <Icon name="menu" />
        </IconButton>
        {logo}
      </div>
      <div className={styles.headerSearch()}>{search}</div>
      <div className={styles.headerEnd()}>
        {actions}
        {account}
      </div>
    </header>
  );
}

/** The field-shaped button that opens the command palette; an icon alone on compact. Its children are its name. */
export function AppShellSearchTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'button'>) {
  const styles = appShellStyles();

  return (
    <button
      type="button"
      data-slot="app-shell-search-trigger"
      aria-haspopup="dialog"
      aria-keyshortcuts="/ Control+K Meta+K"
      className={styles.searchTrigger({ className })}
      {...props}
    >
      <Icon name="search" size="md" className="tw:shrink-0" />
      <span className={styles.searchLabel()}>{children}</span>
      <Kbd aria-hidden="true" className={styles.searchHint()}>
        /
      </Kbd>
    </button>
  );
}
