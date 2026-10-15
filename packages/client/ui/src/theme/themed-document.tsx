import { HeadContent, ScriptOnce, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { SYSTEM_THEME_SCRIPT } from './system-theme';
import type { ThemePreference } from './theme-preference';
import { ThemeProvider, useTheme } from './theme-provider';

export type ThemedDocumentProps = {
  /** The preference the server read from the request's cookie. */
  preference: ThemePreference;
  cookieDomain?: string;
  children: ReactNode;
};

function Document({ children }: { children: ReactNode }) {
  const { preference, theme } = useTheme();

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <HeadContent />
        {preference === 'system' && <ScriptOnce>{SYSTEM_THEME_SCRIPT}</ScriptOnce>}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * The HTML document a client app's root route renders as its shell: the theme on `<html>` as the
 * server read it, resolved in the head before paint when it follows the system, and the theme
 * provider around everything below it.
 */
export function ThemedDocument({ preference, cookieDomain, children }: ThemedDocumentProps) {
  return (
    <ThemeProvider preference={preference} cookieDomain={cookieDomain}>
      <Document>{children}</Document>
    </ThemeProvider>
  );
}
