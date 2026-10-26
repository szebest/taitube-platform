import { componentFiles, componentFolder, isKebab } from '../component-templates';

const request = (overrides: Partial<Parameters<typeof componentFiles>[0]> = {}) => ({
  name: 'chip-bar',
  kind: 'web' as const,
  area: undefined,
  compound: false,
  ...overrides,
});

describe('scripts: the component templates', () => {
  it.each([
    { kind: 'primitive', area: 'browse', folder: 'packages/client/ui/src/primitives/chip-bar' },
    { kind: 'shared', area: 'states', folder: 'packages/client/components/src/states/chip-bar' },
    { kind: 'web', area: 'discovery', folder: 'apps/client/web/src/components/discovery/chip-bar' },
    { kind: 'studio', area: undefined, folder: 'apps/client/studio/src/components/chip-bar' },
  ] as const)('places a $kind component in $folder', ({ kind, area, folder }) => {
    expect(componentFolder(request({ kind, area }))).toBe(folder);
  });

  it.each([
    {
      shape: 'a single component',
      compound: false,
      files: [
        '__tests__/chip-bar.dom.test.tsx',
        'chip-bar.stories.tsx',
        'chip-bar.tsx',
        'chip-bar.variants.ts',
        'index.ts',
        'types.ts',
      ],
    },
    {
      shape: 'a compound one, with its context',
      compound: true,
      files: [
        '__tests__/chip-bar.dom.test.tsx',
        'chip-bar.context.ts',
        'chip-bar.stories.tsx',
        'chip-bar.tsx',
        'chip-bar.variants.ts',
        'index.ts',
        'types.ts',
      ],
    },
  ])('writes the folder shape of $shape', ({ compound, files }) => {
    expect(Object.keys(componentFiles(request({ compound }))).sort()).toEqual(files);
  });

  it.each([
    { kind: 'primitive', from: "from '../../lib/class-names'" },
    { kind: 'web', from: "from '@vp/ui'" },
  ] as const)('takes the helpers of a $kind component $from', ({ kind, from }) => {
    expect(componentFiles(request({ kind }))['chip-bar.variants.ts']).toContain(from);
  });

  it('exports a compound component as its root and parts, with the hook a new part reads', () => {
    expect(componentFiles(request({ compound: true }))['index.ts']).toContain(
      'export const ChipBar = { Root: ChipBarRoot, Item: ChipBarItem };\n'
    );
  });

  it.each([
    { name: 'chip-bar', kebab: true },
    { name: 'ChipBar', kebab: false },
    { name: '../x', kebab: false },
    { name: 'chip--bar', kebab: false },
  ])('reads $name as kebab-case: $kebab', ({ name, kebab }) => {
    expect(isKebab(name)).toBe(kebab);
  });
});
