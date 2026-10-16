import { Link, Outlet } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAuth, useLayoutMaxWidth } from '@vp/queries';
import { BrandLogo, ThemeMenu } from '@vp/ui';

import { WEB_URL } from '#app/config';

/** The studio around every page: the logo, the account, the theme and the way back to the viewer app. */
export function StudioShell() {
  const { account } = useAuth();
  const { tOr } = useT();
  const maxWidth = useLayoutMaxWidth();

  return (
    <>
      <header className="tw:flex tw:items-center tw:gap-4 tw:border-b tw:border-border tw:px-4 tw:py-2">
        <Link to="/" className="tw:flex tw:items-center tw:gap-2 tw:text-fg tw:no-underline">
          <BrandLogo compact />
          <span className="tw:font-medium">{tOr('studio.title', {}, '')}</span>
        </Link>
        <nav className="tw:ml-auto tw:flex tw:items-center tw:gap-3">
          <a href={WEB_URL} className="tw:text-fg-muted">
            {tOr('studio.backToWeb', {}, '')}
          </a>
          <ThemeMenu />
          {account && <span>{account.channel.displayName}</span>}
        </nav>
      </header>
      <main className="tw:mx-auto tw:w-full tw:p-4" style={{ maxWidth }}>
        <Outlet />
      </main>
    </>
  );
}
