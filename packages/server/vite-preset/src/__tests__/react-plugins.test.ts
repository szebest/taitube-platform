import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, type Rolldown } from 'vite';
import { compilerDiagnostics, type ReactCompiler, reactPlugins } from '../react-plugins';

const GREETING = `export function Greeting({ name }: { name: string }) {
  return <p>Hello {name}</p>;
}
`;

async function buildGreeting(compiler: ReactCompiler): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vp-compiler-'));
  const entry = join(root, 'greeting.tsx');
  await writeFile(entry, GREETING);
  const output = (await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: reactPlugins(compiler),
    build: {
      write: false,
      lib: { entry, formats: ['es'] },
      rollupOptions: { external: [/^react/] },
    },
  })) as Rolldown.RolldownOutput[];
  return output[0]?.output[0].code ?? '';
}

describe('@vp/vite-preset: React Compiler', () => {
  it.each([
    { compiler: 'oxc' as const, compiled: true },
    { compiler: 'babel' as const, compiled: true },
    { compiler: false as const, compiled: false },
  ])('builds a component with compiler $compiler', async ({ compiler, compiled }) => {
    expect((await buildGreeting(compiler)).includes('react/compiler-runtime')).toBe(compiled);
  });
});

describe('@vp/vite-preset: compiler diagnostics', () => {
  it.each([
    {
      shape: 'a hook called conditionally',
      source: `import { useState } from 'react';
export function Toggle({ on }: { on: boolean }) {
  if (on) {
    useState(0);
  }
  return null;
}
`,
      diagnostics: [{ line: 4, category: 'Hooks' }],
    },
    { shape: 'a component that compiles', source: GREETING, diagnostics: [] },
  ])('reports $shape with its line and category', async ({ source, diagnostics }) => {
    const found = await compilerDiagnostics('toggle.tsx', source);

    expect(found).toEqual(diagnostics.map((diagnostic) => expect.objectContaining(diagnostic)));
  });
});
