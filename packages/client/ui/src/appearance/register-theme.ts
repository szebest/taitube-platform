import {
  checkThemeContrast,
  parseTheme,
  resolveTheme,
  type Theme,
  type ThemeContrastFailure,
  TOKEN_GROUPS,
  themeCss,
} from '@vp/design-tokens';
import { ErrorCodes, type InputFailure } from '@vp/errors';
import { andThen, err, ok, type Result } from '@vp/result';
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

const install = (host: StyleHost, { id }: Theme, css: string) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const selector = `[data-theme="${id}"]`;
  host.adoptedStyleSheets = [
    ...host.adoptedStyleSheets.filter((adopted) => firstSelector(adopted) !== selector),
    sheet,
  ];
};

/**
 * Adds a theme that arrives as data: parsed, resolved against the ramps, held to the contrast gate
 * and installed as a constructed stylesheet, replacing one registered earlier under its id. With no
 * document (a server render, `host` null) it checks the theme and installs nothing. A constructed
 * sheet is CSSOM, not an inline style, so a CSP `style-src` without 'unsafe-inline' still allows it. Pass the returned theme to
 * `resolveAppearance` as `registered`, so a preference naming it resolves to it.
 */
export function registerTheme(
  input: unknown,
  host: StyleHost | null = globalThis.document ?? null
): Result<Theme, InvalidTheme> {
  const parsed = andThen(
    andThen(parseTheme(input), (theme) => offeredDefaults(theme)),
    (theme) => resolveTheme(theme, ramps)
  );
  if (!parsed.ok) {
    return invalid(parsed.error.field, parsed.error.message);
  }
  const pairs = checkThemeContrast(parsed.value);
  if (pairs.length > 0) {
    return invalid('color', `${pairs.length} contrast pairs are under their floor`, pairs);
  }
  if (host !== null) {
    install(host, parsed.value, themeCss(parsed.value));
  }
  return ok(parsed.value);
}
