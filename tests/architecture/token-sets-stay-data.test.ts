import { productionSources, read, trackedFiles } from './repo-files';

const UI = 'packages/client/ui/src/';
/** Where a token value may be written: the sets and the themes, each its own module. */
const TOKEN_HOMES = [`${UI}tokens/`, `${UI}themes/`];
/** The one module that offers a theme or a set to the apps. */
const REGISTRY = `${UI}appearance/registry.ts`;
const GENERATED = `${UI}styles/generated/`;

const DEFINITION = /\bdefine(?:TokenSet|Theme|Ref)\(/g;
const THEME_OR_SET_IMPORT =
  /\bfrom\s+['"](?:@vp\/ui\/themes\/[^'"]+|[^'"]*\/themes\/[a-z-]+|[^'"]*\/tokens\/[a-z-]+\/[a-z-]+)['"]/g;
const DECLARED = /(?:^|[\s{;'"])(--[a-z][a-z0-9-]*)['"]?\s*:\s*([^;}\n]*)/gm;
/** One token pointed at another, as the more-contrast rule does: a choice between roles, not a value. */
const ALIAS = /^var\(--[a-z0-9-]+\)$/;

const inHome = (file: string) => TOKEN_HOMES.some((home) => file.startsWith(home));

/** A set, theme or ramp defined, or a theme or set imported, outside the token homes and the registry. */
function strayDefinitions(file: string, source: string): string[] {
  if (inHome(file)) return [];
  const definitions = [...source.matchAll(DEFINITION)];
  const imports = file === REGISTRY ? [] : [...source.matchAll(THEME_OR_SET_IMPORT)];
  return [...definitions, ...imports].map(([match]) => `${file}: ${match}`);
}

/** The custom properties the generated stylesheets write: every token variable a set or a theme owns. */
function tokenVariables(generated: readonly string[]): Set<string> {
  return new Set(
    generated.flatMap((source) =>
      [...source.matchAll(DECLARED)].flatMap(([, name]) => (name === undefined ? [] : [name]))
    )
  );
}

/** A token variable given a value by hand, in a stylesheet or an inline style. */
function tokenDeclarations(file: string, source: string, tokens: ReadonlySet<string>): string[] {
  return [...source.matchAll(DECLARED)]
    .filter(
      ([, name, value]) =>
        name !== undefined && tokens.has(name) && !ALIAS.test(value?.trim() ?? '')
    )
    .map(([, name]) => `${file}: ${name}`);
}

describe('architecture: token sets and themes stay data', () => {
  it.each([
    {
      shape: 'a set defined in a component',
      file: `${UI}primitives/card/card.tsx`,
      source: "const cozy = defineTokenSet('radius', 'cozy', {});",
    },
    {
      shape: 'a theme imported by an app',
      file: 'apps/client/web/src/routes/__root.tsx',
      source: "import { nocturne } from '@vp/ui/themes/nocturne';",
    },
    {
      shape: 'a set imported outside the registry',
      file: `${UI}appearance/provider.tsx`,
      source: "import { spacingAiry } from '../tokens/spacing/airy';",
    },
  ])('fires on $shape', ({ file, source }) => {
    expect(strayDefinitions(file, source)).toHaveLength(1);
  });

  it.each([
    {
      shape: 'a theme naming its default sets',
      file: `${UI}themes/sand/index.ts`,
      source: "import { shadowSoft } from '../../tokens/shadow/soft';\ndefineTheme({});",
    },
    {
      shape: 'the registry offering them',
      file: REGISTRY,
      source: "import { sand } from '../themes/sand';",
    },
    {
      shape: 'the ramps a registered theme resolves through',
      file: `${UI}appearance/register-theme.ts`,
      source: "import { ramps } from '../tokens/ref';",
    },
  ])('leaves $shape alone', ({ file, source }) => {
    expect(strayDefinitions(file, source)).toEqual([]);
  });

  it('fires on a token variable set by hand, and not on a variable of its own', () => {
    const tokens = tokenVariables([
      ':root[data-theme="sand"] {\n  --accent: #C9A66B;\n  --r-card: 12px;\n}',
    ]);
    const source = [
      '.card { --r-card: 4px; }',
      "<div style={{ '--accent': colour }} />",
      ':root { --motion-travel: 1; }',
      '.x { border-radius: var(--r-card); }',
      '[data-contrast="more"] { --accent: var(--r-card); }',
    ].join('\n');

    expect(tokenDeclarations('fixture.css', source, tokens)).toEqual([
      'fixture.css: --r-card',
      'fixture.css: --accent',
    ]);
  });

  it('finds no set, theme or ramp defined or offered outside the token homes and the registry (the scaffold script writes them as text)', () => {
    const shipped = productionSources().filter((file) => /^(?:apps|packages)\//.test(file));

    expect(shipped.flatMap((file) => strayDefinitions(file, read(file)))).toEqual([]);
  });

  it('finds no token variable given a value outside the generated stylesheets', () => {
    const generated = trackedFiles(GENERATED);
    const tokens = tokenVariables(generated.map(read));
    const sources = trackedFiles(
      ':(glob)apps/client/*/src/**/*.css',
      ':(glob)apps/client/*/src/**/*.scss',
      ':(glob)packages/client/*/src/**/*.css',
      ':(glob)packages/client/workbench/.storybook/*.css',
      ...productionSources().filter((file) => /^(?:apps|packages)\/client\//.test(file)),
      `:(exclude)${GENERATED}`
    ).filter((file) => !inHome(file));

    expect(tokens.size).toBeGreaterThan(50);
    expect(sources.flatMap((file) => tokenDeclarations(file, read(file), tokens))).toEqual([]);
  });
});
