import { Link, Outlet } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { AccountMenu, useLayoutMaxWidth } from '@vp/queries';
import { Logo, ThemeMenu } from '@vp/ui';

import { WEB_URL } from '#app/config';

/** The studio around every page: the logo, the account, the theme and the way back to the viewer app. */
export function StudioShell() {
  const { tOr } = useT();
  const maxWidth = useLayoutMaxWidth();

  return (
    <>
      <header className="tw:flex tw:items-center tw:gap-4 tw:border-b tw:border-border tw:px-4 tw:py-2">
        <Link to="/" className="tw:flex tw:items-center tw:gap-2 tw:text-fg tw:no-underline">
          <Logo />
          <span className="tw:font-medium">{tOr('studio.title', {}, '')}</span>
        </Link>
        <nav className="tw:ml-auto tw:flex tw:items-center tw:gap-3">
          <a href={WEB_URL} className="tw:text-fg-muted">
            {tOr('studio.backToWeb', {}, '')}
          </a>
          <ThemeMenu />
          <AccountMenu studioUrl="" />
        </nav>
      </header>
      <main className="tw:mx-auto tw:w-full tw:p-4" style={{ maxWidth }}>
        <Outlet />
      </main>
    </>
  );
}
