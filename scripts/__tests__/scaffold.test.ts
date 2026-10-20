import { copySetModule, copyThemeModule, groupNamed, register } from '../scaffold';

const REGISTRY = [
  "import { defineAppearance } from '@vp/design-tokens';",
  "import { sand } from '../themes/sand';",
  "import { shadowDeep } from '../tokens/shadow/deep';",
  "import { shadowSoft } from '../tokens/shadow/soft';",
  '',
  'export const appearance = defineAppearance({',
  '  themes: [sand],',
  '  offer: {',
  '    shadow: [shadowSoft, shadowDeep],',
  '  },',
  '});',
].join('\n');

describe('scripts: the scaffolds', () => {
  it.each([
    { name: 'fontSize', group: 'fontSize' },
    { name: 'font-size', group: 'fontSize' },
    { name: 'fonts', group: undefined },
  ])('reads the group $name as $group', ({ name, group }) => {
    expect(groupNamed(name)).toBe(group);
  });

  it('copies a set module under its new id and name', () => {
    const copy = copySetModule(
      "export const shadowDeep = defineTokenSet('shadow', 'deep', {\n  x: 1,\n});\n",
      {
        group: 'shadow',
        from: 'deep',
        to: 'extra-deep',
      }
    );

    expect(copy).toBe(
      "export const shadowExtraDeep = defineTokenSet('shadow', 'extra-deep', {\n  x: 1,\n});\n"
    );
  });

  it('copies a theme module under its new id, name and identifier', () => {
    const copy = copyThemeModule(
      "export const sand = defineTheme({\n  id: 'sand',\n  name: 'Sand',\n  color,\n});\n",
      {
        from: 'sand',
        to: 'late-dusk',
      }
    );

    expect(copy).toBe(
      "export const lateDusk = defineTheme({\n  id: 'late-dusk',\n  name: 'Late Dusk',\n  color,\n});\n"
    );
  });

  it('refuses a module that is not the shape a scaffold writes', () => {
    expect(
      copySetModule('export const other = 1;', { group: 'shadow', from: 'deep', to: 'x' })
    ).toBeUndefined();
  });

  it('imports the new module in path order and appends it to its list', () => {
    const registered = register(REGISTRY, {
      key: 'shadow',
      identifier: 'shadowDramatic',
      path: '../tokens/shadow/dramatic',
    });

    expect(registered?.split('\n')).toEqual([
      "import { defineAppearance } from '@vp/design-tokens';",
      "import { sand } from '../themes/sand';",
      "import { shadowDeep } from '../tokens/shadow/deep';",
      "import { shadowDramatic } from '../tokens/shadow/dramatic';",
      "import { shadowSoft } from '../tokens/shadow/soft';",
      '',
      'export const appearance = defineAppearance({',
      '  themes: [sand],',
      '  offer: {',
      '    shadow: [shadowSoft, shadowDeep, shadowDramatic],',
      '  },',
      '});',
    ]);
  });

  it('leaves a list that is not on one line to the hand that prints it', () => {
    const multiline = REGISTRY.replace(
      '    shadow: [shadowSoft, shadowDeep],',
      '    shadow: [\n      shadowSoft,\n    ],'
    );

    expect(
      register(multiline, { key: 'shadow', identifier: 'shadowX', path: '../tokens/shadow/x' })
    ).toBeUndefined();
  });
});
