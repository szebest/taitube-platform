import { defineConfig } from 'vite-plus';
import { serverBundle } from '../../../scripts/server-bundle';

export default defineConfig({
  pack: serverBundle(['src/main.ts', 'src/instrument.ts']),
});
