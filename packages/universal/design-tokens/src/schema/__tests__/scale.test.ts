import { ScaleSchema } from '../scale';
import { scaleFromTokens } from './tokens-json';

const scaleWith = (group: string, change: Record<string, unknown>) => {
  const scale = scaleFromTokens();
  return { ...scale, [group]: { ...Object(scale[group]), ...change } };
};

describe('ScaleSchema', () => {
  it('parses the scale in tokens.json', () => {
    expect(ScaleSchema.safeParse(scaleFromTokens()).error).toBeUndefined();
  });

  it.each([
    { label: 'a space step off the 4 px grid', scale: scaleWith('space', { 4: '18px' }) },
    { label: 'a space step Tailwind has no index for', scale: scaleWith('space', { 7: '28px' }) },
    { label: 'tooltips layered under toasts', scale: scaleWith('z', { tooltip: 65 }) },
    { label: 'a fractional layer', scale: scaleWith('z', { modal: 50.5 }) },
    {
      label: 'a breakpoint below the one before it',
      scale: scaleWith('breakpoint', { large: '1000px' }),
    },
    { label: 'a layout measure in em', scale: scaleWith('layout', { 'reading-max': '40em' }) },
  ])('rejects $label', ({ scale }) => {
    expect(ScaleSchema.safeParse(scale).success).toBe(false);
  });
});
