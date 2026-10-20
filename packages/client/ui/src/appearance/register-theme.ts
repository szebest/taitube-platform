import {
  checkThemeContrast,
  parseTheme,
  resolveTheme,
  type Theme,
  type ThemeContrastFailure,
  TOKEN_GROUPS,
  themeCss,
} from '@vp/design-tokens';
import { ErrorCodes, type Failure, type InputFailure } from '@vp/errors';
import { andThen, err, map, ok, type Result, tryCatch } from '@vp/result';
import { ramps } from '../tokens/ref';
import { appearance } from './registry';

/** `pairs` holds what failed the contrast gate, and is empty when the theme did not parse. */
export type InvalidTheme = InputFailure<
  typeof ErrorCodes.VALIDATION_FAILED,
  { pairs: readonly ThemeContrastFailure[] }
>;

type StyleHost = Pick<Document, 'adoptedStyleSheets'>;

const invalid = (field: string, message: string, pairs: readonly ThemeContrastFailure[] = []) =>
  err<InvalidTheme>({ code: ErrorCodes.VALIDATION_FAILED, message, field, pairs });

const offeredDefaults = (theme: Theme): Result<Theme, InvalidTheme> => {
  if (appearance.themes.some(({ id }) => id === theme.id)) {
    return invalid('id', `${theme.id} is a built-in theme`);
  }
  const unoffered = TOKEN_GROUPS.find(
    (group) => !appearance.offer[group].some(({ id }) => id === theme.defaults[group].id)
  );
  return unoffered === undefined
    ? ok(theme)
    : invalid(`defaults.${unoffered}`, `${theme.defaults[unoffered].id} is not an offered set`);
};

const firstSelector = (sheet: CSSStyleSheet) => {
  const [rule] = sheet.cssRules;
  return rule instanceof CSSStyleRule ? rule.selectorText : undefined;
};

/** No constructable stylesheets in this browser: the theme passed, but nothing could install it. */
export type ThemeNotInstalled = Failure<typeof ErrorCodes.INTERNAL>;

export type RegisteredTheme = Readonly<{ theme: Theme; css: string }>;

const install = (host: StyleHost, { id }: Theme, css: string) =>
  tryCatch(
    () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      const selector = `[data-theme="${id}"]`;
      host.adoptedStyleSheets = [
        ...host.adoptedStyleSheets.filter((adopted) => firstSelector(adopted) !== selector),
        sheet,
      ];
    },
    (cause): ThemeNotInstalled => ({
      code: ErrorCodes.INTERNAL,
      message: `the ${id} stylesheet could not be installed: ${String(cause)}`,
    })
  );

/**
 * Adds a theme that arrives as data: parsed, resolved against the ramps, held to the contrast gate
 * and installed as a constructed stylesheet, replacing one registered earlier under its id. A
 * constructed sheet is CSSOM, not an inline style, so a CSP `style-src` without 'unsafe-inline'
 * still allows it. With no document (a server render, `host` null) nothing is installed: the
 * caller inlines the returned `css` in the page, under the request nonce, or a page naming the
 * theme paints unstyled. Pass the returned theme to `resolveAppearance` as `registered`.
 */
export function registerTheme(
  input: unknown,
  host: StyleHost | null = globalThis.document ?? null
): Result<RegisteredTheme, InvalidTheme | ThemeNotInstalled> {
  const parsed = andThen(
    andThen(parseTheme(input), (theme) => offeredDefaults(theme)),
    (theme) => resolveTheme(theme, ramps)
  );
  if (!parsed.ok) {
    return invalid(parsed.error.field, parsed.error.message);
  }
  const theme = parsed.value;
  const pairs = checkThemeContrast(theme);
  if (pairs.length > 0) {
    return invalid('color', `${pairs.length} contrast pairs are under their floor`, pairs);
  }
  const css = themeCss(theme);
  if (host === null) {
    return ok({ theme, css });
  }
  return map(install(host, theme, css), () => ({ theme, css }));
}
