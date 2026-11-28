import { ThemedDocument } from '@kit/ui';
import { getRouteApi } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { webComposition } from '#app/composition/registry';
import { ThemeColorMeta } from '#app/features/pwa';

const rootRoute = getRouteApi('__root__');

export function RootDocument({ children }: { children: ReactNode }) {
  const { appearance, locale, direction } = rootRoute.useRouteContext();

  return (
    <ThemedDocument
      stored={appearance}
      lang={locale}
      dir={direction}
      cookieDomain={webComposition.cookieDomain}
    >
      <ThemeColorMeta />
      {children}
    </ThemedDocument>
  );
}
