import { PLATFORM_ICON_PATHS } from '../platform-icon-paths.generated';

describe('@kit/ui: generated platform icon paths', () => {
  it.each(Object.entries(PLATFORM_ICON_PATHS))(
    '%s is one SVG path that starts with a move',
    (_name, path) => {
      expect(path).toMatch(/^M/);
    }
  );
});
