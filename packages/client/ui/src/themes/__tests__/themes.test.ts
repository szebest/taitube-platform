import { readdirSync } from 'node:fs';
import {
  checkThemeContrast,
  contrastRatio,
  parseTheme,
  resolveTheme,
  type Theme,
} from '@vp/design-tokens';
import { expectOk } from '@vp/testing/result';
import { ramps } from '../../tokens/ref';

const folders = readdirSync(new URL('..', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '__tests__')
  .map(({ name }) => name);

const resolvedTheme = async (folder: string) => {
  const exports: Record<string, Theme> = await import(`../${folder}/index.ts`);
  const [theme, ...others] = Object.values(exports);
  expect(others).toEqual([]);
  return expectOk(resolveTheme(expectOk(parseTheme(theme)), ramps));
};

describe('@vp/ui: the themes', () => {
  it.each(folders)(
    '%s exports one theme that parses, resolves and is the folder it sits in',
    async (folder) => {
      const theme = await resolvedTheme(folder);

      expect(theme.id).toBe(folder);
    }
  );

  it.each(folders)(
    '%s clears every required contrast pair, and draws every chart series at 3:1 on surface, in every mode',
    async (folder) => {
      expect(checkThemeContrast(await resolvedTheme(folder))).toEqual([]);
    }
  );

  it.each(
    folders.flatMap((folder) =>
      (['light', 'dark', 'oled'] as const).map((mode) => [folder, mode] as const)
    )
  )(
    '%s %s draws the header search trigger, its border and its "/" hint, at 3:1 and 4.5:1 in both contrasts',
    async (folder, mode) => {
      const { color } = await resolvedTheme(folder);
      const roles = mode === 'oled' ? { ...color.dark, ...color.oled } : color[mode];
      const more = { ...roles, border: roles['border-strong'], 'fg-muted': roles.fg };

      for (const drawn of [roles, more]) {
        expect(contrastRatio(drawn['border-strong'], drawn.bg)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(drawn['border-strong'], drawn.surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(drawn['fg-muted'], drawn.surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  );
});
