import { trackedFiles } from './repo-files';

/** The homes a stylesheet may have: the design system's own, the workbench preview, and the design docs. */
const STYLESHEET_HOMES = [
  'packages/client/ui/src/styles/',
  'packages/client/workbench/.storybook/',
  'docs/',
];

const STYLESHEET = /\.(?:css|scss|sass|less|styl)$/;

/** Every stylesheet outside the homes. */
function newStylesheets(files: readonly string[]): string[] {
  return files
    .filter((file) => STYLESHEET.test(file))
    .filter((file) => !STYLESHEET_HOMES.some((home) => file.startsWith(home)));
}

describe('architecture: no new stylesheet', () => {
  it.each([
    'apps/client/web/src/features/watch/components/stage.module.css',
    'packages/client/components/src/page-header/page-header.scss',
    'packages/client/forms/src/file-field/file-field.module.css',
    'apps/client/web/src/styles/components/rail.scss',
  ])('fires on %s', (file) => {
    expect(newStylesheets([file])).toEqual([file]);
  });

  it.each([
    'packages/client/ui/src/styles/base.css',
    'docs/design/lib/design.css',
    'apps/client/web/src/features/watch/components/stage.tsx',
  ])('leaves %s alone', (file) => {
    expect(newStylesheets([file])).toEqual([]);
  });

  it('finds no stylesheet outside the homes', () => {
    expect(newStylesheets(trackedFiles())).toEqual([]);
  });
});
