import { DOM_SPECS, MSW_SETUP, webTestConfig } from './vitest.config';

export default await webTestConfig({
  name: 'web (jsdom)',
  environment: 'jsdom',
  isolate: true,
  include: [DOM_SPECS],
  setupFiles: ['@testing-library/jest-dom/vitest', '@vp/web-testing/jsdom.setup', MSW_SETUP],
});
