import { useRouter } from '@tanstack/react-router';
import { brandAccentCss, brandKey } from '@vp/design-tokens';
import { unwrapOr } from '@vp/result';
import type { PropsWithChildren } from 'react';
import { InlineStyle } from './inline-style';
import { useAppearance } from './provider';

export type BrandScopeProps = PropsWithChildren<{
  /** A channel's `#rrggbb` brand colour, or `null` for a channel with none. */
  color: string | null;
}>;

/**
 * Puts a channel's accent on its subtree, derived for the viewer's mode: `accent`, `accent-hover`,
 * `accent-ink`, `accent-soft`, `focus-ring` and `on-accent`, never `live`, `danger` or a status role.
 * A viewer's own accent wins, so with one set, or a colour the engine cannot read, the children
 * render as they are.
 */
export function BrandScope({ color, children }: BrandScopeProps) {
  const { preference } = useAppearance();
  const nonce = useRouter().options.ssr?.nonce;
  const css =
    color === null || preference.accent !== null ? '' : unwrapOr(brandAccentCss(color), '');

  if (color === null || css === '') {
    return children;
  }

  return (
    <div data-brand={brandKey(color)} className="contents">
      <InlineStyle css={css} nonce={nonce} />
      {children}
    </div>
  );
}
