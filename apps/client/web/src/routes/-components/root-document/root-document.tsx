import { getRouteApi } from '@tanstack/react-router';
import { ThemedDocument } from '@vp/ui';
import type { ReactNode } from 'react';
import { ThemeColorMeta } from '#app/features/pwa';
import { COOKIE_DOMAIN } from '#app/lib/config';

const rootRoute = getRouteApi('__root__');

export function RootDocument({ children }: { children: ReactNode }) {
  const { appearance, locale, direction } = rootRoute.useRouteContext();

  return (
    <ThemedDocument stored={appearance} lang={locale} dir={direction} cookieDomain={COOKIE_DOMAIN}>
      <ThemeColorMeta />
      {children}
    </ThemedDocument>
  );
}
