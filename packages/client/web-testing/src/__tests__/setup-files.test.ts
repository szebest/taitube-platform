import { JSDOM_SETUP_FILES, NODE_SETUP_FILES, SPEC_ENV } from '../setup-files';

describe('@vp/web-testing: setup files', () => {
  it.each([...NODE_SETUP_FILES, ...JSDOM_SETUP_FILES])(
    'names a setup file that resolves: %s',
    (file) => {
      expect(() => import.meta.resolve(file)).not.toThrow();
    }
  );

  it('runs every spec with the demo personas on', () => {
    expect(SPEC_ENV).toEqual({ VITE_DEMO_PERSONAS: 'true' });
  });
});
