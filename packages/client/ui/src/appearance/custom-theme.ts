import { buildTheme, resolveTheme, type ThemeColours } from '@vp/design-tokens';
import { ErrorCodes } from '@vp/errors';
import { err, type Result } from '@vp/result';
import {
  type InvalidTheme,
  type RegisteredTheme,
  registerTheme,
  type ThemeNotInstalled,
} from './register-theme';
import { ramps } from '../tokens/ref';
import { appearance } from './registry';

export const CUSTOM_THEME_ID = 'custom';

const CUSTOM_THEME_NAME = 'Custom';

const startingColours = (): ThemeColours => {
  const resolved = resolveTheme(appearance.defaultTheme, ramps);
  if (!resolved.ok) {
    throw new Error(`the default theme does not resolve: ${resolved.error.message}`);
  }
  const { bg, accent } = resolved.value.color.dark;
  return { ground: bg, accent };
};

/** The default theme's own page and accent, which the builder opens on. */
export const CUSTOM_THEME_START = startingColours();

/**
 * The viewer's own theme over the default theme's remaining roles and token sets, held to the same
 * gate as any registered theme. With `host` null nothing is installed, which is how a form checks
 * a colour pair before it keeps it and how the provider reads the theme to inline.
 */
export function registerCustomTheme(
  colours: ThemeColours,
  host?: Parameters<typeof registerTheme>[1]
): Result<RegisteredTheme, InvalidTheme | ThemeNotInstalled> {
  const built = buildTheme(
    appearance.defaultTheme,
    { id: CUSTOM_THEME_ID, name: CUSTOM_THEME_NAME },
    colours
  );
  if (!built.ok) {
    const { message, field } = built.error;
    return err<InvalidTheme>({ code: ErrorCodes.VALIDATION_FAILED, message, field, pairs: [] });
  }
  return registerTheme(built.value, host);
}
