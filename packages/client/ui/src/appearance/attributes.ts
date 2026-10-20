import { TOKEN_GROUPS, tokenGroups } from '@vp/design-tokens';
import type { ShownMode } from './provider';
import type { ResolvedAppearance } from './resolve';

type Shown = Readonly<{ resolved: ResolvedAppearance; shownMode: ShownMode }>;

/** What `<html>` carries for an appearance: the theme, mode, contrast and one attribute per group. */
export const appearanceAttributes = ({ resolved, shownMode }: Shown): Record<string, string> => ({
  'data-theme': resolved.theme.id,
  'data-mode': shownMode,
  'data-contrast': resolved.contrast,
  ...Object.fromEntries(
    TOKEN_GROUPS.map((group) => [`data-${tokenGroups[group].path}`, resolved.sets[group].id])
  ),
});

/** The same attributes on an element the app does not render, such as the workbench's `<html>`. */
export function applyAppearance(element: Element, shown: Shown): void {
  for (const [name, value] of Object.entries(appearanceAttributes(shown))) {
    element.setAttribute(name, value);
  }
}
