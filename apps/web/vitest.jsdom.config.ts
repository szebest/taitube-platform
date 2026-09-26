import { DOM_SPECS, MSW_SETUP, webTestConfig } from './vitest.config';

export default await webTestConfig({
  name: 'web (jsdom)',
  environment: 'jsdom',
  include: [DOM_SPECS],
  setupFiles: ['@testing-library/jest-dom/vitest', 'src/__tests__/jsdom.setup.ts', MSW_SETUP],
});
