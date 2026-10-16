import { clientAppTestConfig } from '@vp/vite-preset/vitest';
import viteConfig from './vite.config';

export default await clientAppTestConfig(viteConfig, { app: 'studio', environment: 'node' });
