import { HeadContent, ScriptOnce, Scripts, useRouter } from '@tanstack/react-router';
import { accentCss } from '@vp/design-tokens';
import { unwrapOr } from '@vp/result';
import type { ReactNode } from 'react';
import { appearanceAttributes } from './attributes';
import { prePaintScript } from './pre-paint';
import { AppearanceProvider, type AppearanceProviderProps, useAppearance } from './provider';
import type { RegisteredTheme } from './register-theme';

export type ThemedDocumentProps = Omit<AppearanceProviderProps, 'registered'> & {
  /** Themes `registerTheme` added; their CSS goes inline in the head, under the request nonce. */
  registered?: readonly RegisteredTheme[];
  children: ReactNode;
};

function InlineStyle({ css, nonce }: Readonly<{ css: string; nonce: string | undefined }>) {
  return (
    <style
      nonce={nonce}
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: generated CSS of schema-checked ids and colours, which React would escape into broken selectors.
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}

function Document({ registered, children }: Pick<ThemedDocumentProps, 'registered' | 'children'>) {
  const shown = useAppearance();
  const { preference, resolved } = shown;
  const nonce = useRouter().options.ssr?.nonce;
  const accent = resolved.accent === null ? '' : unwrapOr(accentCss(resolved.accent), '');

  return (
    <html lang="en" {...appearanceAttributes(shown)} suppressHydrationWarning>
      <head>
        <HeadContent />
        <ScriptOnce>{prePaintScript(preference.mode === 'system')}</ScriptOnce>
        {registered?.map(({ theme, css }) => (
          <InlineStyle key={theme.id} css={css} nonce={nonce} />
        ))}
        {accent !== '' && <InlineStyle css={accent} nonce={nonce} />}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * The HTML document a client app's root route renders as its shell: on `<html>` the theme, mode,
 * contrast and one `data-<group>` per token group as the server resolved them from the cookie, the
 * accent override and registered themes inline, a pre-paint script for what only the browser knows,
 * and the appearance provider around everything below it.
 */
export function ThemedDocument({ registered, children, ...provider }: ThemedDocumentProps) {
  return (
    <AppearanceProvider {...provider} registered={registered?.map(({ theme }) => theme)}>
      <Document registered={registered}>{children}</Document>
    </AppearanceProvider>
  );
}
