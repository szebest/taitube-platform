import { readdirSync } from 'node:fs';
import {
  checkContrast,
  checkRoleContrast,
  NON_TEXT_FLOOR,
  parseTheme,
  type ResolvedTheme,
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

const MODES = [
  { mode: 'dark', palette: 'categorical-dark' },
  { mode: 'light', palette: 'categorical-light' },
  { mode: 'oled', palette: 'categorical-dark' },
] as const;

const rolesIn = ({ color }: ResolvedTheme, mode: (typeof MODES)[number]['mode']) =>
  mode === 'oled' ? { ...color.dark, ...color.oled } : color[mode];

const walk = folders.flatMap((folder) => MODES.map((mode) => ({ folder, ...mode })));

describe('@vp/ui: the themes', () => {
  it.each(folders)(
    '%s exports one theme that parses, resolves and is the folder it sits in',
    async (folder) => {
      const theme = await resolvedTheme(folder);

      expect(theme.id).toBe(folder);
    }
  );

  it.each(walk)('$folder $mode clears every required contrast pair', async ({ folder, mode }) => {
    const roles = rolesIn(await resolvedTheme(folder), mode);

    expect(checkRoleContrast(roles)).toEqual([]);
  });

  it.each(walk)(
    '$folder $mode draws every chart series at 3:1 on surface',
    async ({ folder, mode, palette }) => {
      const theme = await resolvedTheme(folder);
      const { surface } = rolesIn(theme, mode);
      const series = theme.dataviz[palette].map((foreground) => ({
        foreground,
        background: surface,
        floor: NON_TEXT_FLOOR,
      }));

      expect(checkContrast(series)).toEqual([]);
    }
  );
});
