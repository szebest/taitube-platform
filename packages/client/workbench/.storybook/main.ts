import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { workspaceSourceAliases } from '@vp/vite-preset';
import { mergeConfig } from 'vite';

const PACKAGES_DIR = fileURLToPath(new URL('../../../', import.meta.url));

const START_STUB = fileURLToPath(new URL('./tanstack-start.ts', import.meta.url));

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: [
    '../../../client/*/src/**/*.stories.tsx',
    '../../../../apps/client/*/src/**/*.stories.tsx',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  viteFinal: (vite) =>
    mergeConfig(vite, {
      resolve: {
        alias: [
          { find: /^@tanstack\/react-start(\/server)?$/, replacement: START_STUB },
          ...workspaceSourceAliases(PACKAGES_DIR),
        ],
      },
      plugins: [tailwindcss()],
    }),
};

export default config;
