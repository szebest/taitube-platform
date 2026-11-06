import { isModuleImportFailure, watchPreloadErrors } from '../module-import-failure';

describe('@vp/ui: isModuleImportFailure', () => {
  it.each([
    {
      name: 'a Chrome dynamic import',
      error: new TypeError('Failed to fetch dynamically imported module: https://x/a.js'),
    },
    {
      name: 'a Firefox dynamic import',
      error: new TypeError('error loading dynamically imported module'),
    },
    { name: 'a Safari dynamic import', error: new TypeError('Importing a module script failed.') },
  ])('recognises $name', ({ error }) => {
    expect(isModuleImportFailure(error)).toBe(true);
  });

  it.each([
    { name: 'a render error', error: new Error('x is not a function') },
    {
      name: 'a TypeError of the component',
      error: new TypeError('Cannot read properties of undefined'),
    },
    {
      name: 'the same words in a plain Error',
      error: new Error('Failed to fetch dynamically imported module'),
    },
    { name: 'a string', error: 'Failed to fetch dynamically imported module' },
    { name: 'null', error: null },
  ])('leaves $name alone', ({ error }) => {
    expect(isModuleImportFailure(error)).toBe(false);
  });

  it('recognises the error Vite reports on vite:preloadError, whatever its message', () => {
    watchPreloadErrors();
    const error = new Error('Unable to preload CSS for /assets/a.css');

    const event = Object.assign(new Event('vite:preloadError'), { payload: error });
    window.dispatchEvent(event);

    expect(isModuleImportFailure(error)).toBe(true);
  });
});
