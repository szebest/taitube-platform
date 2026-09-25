import { createRequire } from 'node:module';
import type TypeScript from 'typescript';

const ts: typeof TypeScript = createRequire(import.meta.url)('typescript');

/**
 * Loaded with `require`: an `import` sends the 9 MB CommonJS bundle through Node's format detection
 * and export lexer first, which doubles what each worker pays before its first assertion. Both
 * architecture configs alias `typescript` here, so specs keep `import ts from 'typescript'`.
 *
 * @public
 */
export default ts;
