import { defineConfig } from 'vite-plus';
import { lintWithoutBaseline } from '../../lint.config';

/** What `pnpm react-compiler:report` lints the baseline's files with, to find an entry whose rule stopped firing. */
export default defineConfig({ lint: lintWithoutBaseline });
