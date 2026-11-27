export const NODE_SETUP_FILES = [
  '@kit/web-testing/server-functions.setup',
  '@vp/web-testing/api-server.setup',
] as const;

export const JSDOM_SETUP_FILES = [
  '@testing-library/jest-dom/vitest',
  '@kit/web-testing/jsdom.setup',
  '@vp/web-testing/api-server.setup',
  '@kit/web-testing/settle.setup',
] as const;

export const SPEC_ENV = { VITE_DEMO_PERSONAS: 'true' } as const;
