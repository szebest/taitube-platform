import { clientAppConfig } from '@vp/vite-preset';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5173,
  devOnlyDirs: ['src/features/design-system'],
  forbiddenDirs: ['src/modules/Upload', 'src/features/upload', 'src/routes/_authed/upload'],
});
