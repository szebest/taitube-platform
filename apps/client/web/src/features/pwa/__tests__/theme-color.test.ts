import { appearance } from '@vp/ui/appearance/registry';
import { themeColorMetas } from '../theme-color';

const [sand, nocturne] = appearance.themes;

describe('apps/client/web: theme colours', () => {
  it.each([
    { theme: sand, mode: 'dark' as const, bg: '#14120F' },
    { theme: sand, mode: 'light' as const, bg: '#F6F2EB' },
    { theme: nocturne, mode: 'dark' as const, bg: '#0B0E14' },
    { theme: nocturne, mode: 'oled' as const, bg: '#000000' },
  ])('reads the $mode bg of $theme.id as $bg', ({ theme, mode, bg }) => {
    expect(themeColorMetas(theme, mode)).toEqual([{ content: bg }]);
  });

  it('gives one tag per colour scheme when the mode follows the system', () => {
    expect(themeColorMetas(sand, 'system')).toEqual([
      { media: '(prefers-color-scheme: dark)', content: '#14120F' },
      { media: '(prefers-color-scheme: light)', content: '#F6F2EB' },
    ]);
  });

  it.each([
    { mode: 'dark' as const, content: '#14120F' },
    { mode: 'light' as const, content: '#F6F2EB' },
  ])('gives the one tag of the $mode mode, with no media query', ({ mode, content }) => {
    expect(themeColorMetas(sand, mode)).toEqual([{ content }]);
  });
});
