import { defineConfig } from 'vite-plus';
import { lint } from '../../../lint.config';

export default defineConfig({ lint: { ...lint, ignorePatterns: [] } });
