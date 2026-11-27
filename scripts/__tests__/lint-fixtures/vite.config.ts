import { defineConfig } from 'vite-plus';
import { lint, NEWER_THAN_FLOOR } from '../../../lint.config';

export default defineConfig({
  lint: {
    ...lint,
    ignorePatterns: [],
    overrides: [
      ...(lint.overrides ?? []),
      { files: ['**/view-transition-*.ts'], rules: NEWER_THAN_FLOOR },
    ],
  },
});
