import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import type { PluginOption } from 'vite';

/**
 * Which React Compiler builds the app: `oxc` (the Rust port), `babel` for a package the Oxc port breaks, or
 * `false` while an Oxc compiler issue is open and nothing else builds. Every use but `oxc` names its issue.
 */
export type ReactCompiler = 'oxc' | 'babel' | false;

/** The React plugins every client build, spec run and story run uses, with the given compiler. */
export function reactPlugins(compiler: ReactCompiler = 'oxc'): PluginOption[] {
  switch (compiler) {
    case 'oxc':
      return [viteReact({ compiler: true })];
    case 'babel':
      return [
        viteReact(),
        import('@rolldown/plugin-babel').then(({ default: babel }) =>
          babel({ presets: [reactCompilerPreset()] })
        ),
      ];
    case false:
      return [viteReact()];
  }
}

export type CompilerDiagnostic = {
  line: number;
  /** The compiler's own category, `Hooks` or `Todo`: the name its codeframe prints. */
  category: string;
  message: string;
};

const CATEGORY = /react-compiler\((\w+)\)/;

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}

/** What the Oxc compiler reports for one module, compiled as the `oxc` plugins compile it. */
export async function compilerDiagnostics(
  filename: string,
  source: string
): Promise<CompilerDiagnostic[]> {
  const { transform } = await import('oxc-transform-react');
  const { errors } = await transform(filename, source, {
    jsx: 'preserve',
    reactCompiler: { reportDiagnostics: true },
  });
  return errors.map((error) => ({
    line: lineAt(source, error.labels[0]?.start ?? 0),
    category: CATEGORY.exec(error.codeframe ?? '')?.[1] ?? 'Unknown',
    message: error.message,
  }));
}
