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
