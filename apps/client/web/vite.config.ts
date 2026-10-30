import { clientAppConfig } from '@vp/vite-preset';
import { pwaPlugins } from './vite-pwa';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5173,
  forbiddenDirs: ['src/modules/Upload', 'src/features/upload', 'src/routes/_authed/upload'],
  plugins: pwaPlugins,
});
