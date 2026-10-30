import { trackedFiles } from './repo-files';

/** The homes a stylesheet may have: the design system's own, the workbench preview, and the design docs. */
const STYLESHEET_HOMES = [
  'packages/client/ui/src/styles/',
  'packages/client/workbench/.storybook/',
  'docs/',
];

/**
 * The stylesheets of the legacy pages, frozen as they are: they go with Bootstrap, and this list only
 * ever shrinks, to empty.
 */
const LEGACY_STYLESHEETS: ReadonlySet<string> = new Set([
  'apps/client/studio/src/modules/Upload/components/upload-progress/upload-progress.module.css',
  'apps/client/studio/src/modules/Upload/components/video-form/video-form.module.css',
  'apps/client/studio/src/studio.css',
  'apps/client/web/src/index.scss',
  'apps/client/web/src/modules/SubscriptionVideos/pages/subscription-videos-page/subscription-videos-page.module.scss',
  'apps/client/web/src/modules/Subscriptions/components/subscription-card/subscription-card.module.scss',
  'apps/client/web/src/modules/Subscriptions/pages/subscriptions-page/subscriptions-page.module.scss',
  'apps/client/web/src/modules/UserPage/components/user-details/user-details.module.scss',
  'apps/client/web/src/modules/UserPage/pages/user-page/user-page.module.scss',
  'apps/client/web/src/modules/shared/components/loading-spinner/loading-spinner.module.scss',
  'apps/client/web/src/modules/shared/components/profile-picture/profile-picture.module.scss',
  'apps/client/web/src/modules/shared/components/subscribe-button/subscribe-button.module.scss',
  'apps/client/web/src/modules/shared/components/video-card/video-card.module.scss',
  'apps/client/web/src/modules/shared/components/video-settings-dropdown/video-settings-dropdown.module.scss',
  'apps/client/web/src/modules/shared/components/videos-container/videos-container.module.scss',
  'apps/client/web/src/styles/abstract/_colors.scss',
  'apps/client/web/src/styles/abstract/_dark.scss',
  'apps/client/web/src/styles/abstract/_light.scss',
  'apps/client/web/src/styles/abstract/_mixins.scss',
  'apps/client/web/src/styles/abstract/_variables.scss',
  'apps/client/web/src/styles/base/_base.scss',
  'apps/client/web/src/styles/components/button.scss',
  'apps/client/web/src/styles/components/chip.scss',
  'apps/client/web/src/styles/components/dropdown.scss',
  'apps/client/web/src/styles/components/form-controls.scss',
  'apps/client/web/src/styles/components/modal.scss',
  'apps/client/web/src/styles/components/select.scss',
  'apps/client/web/src/styles/components/toast.scss',
  'apps/client/web/src/styles/main.scss',
  'packages/client/forms/src/file-field.module.css',
]);

const STYLESHEET = /\.(?:css|scss|sass|less|styl)$/;

/** Every stylesheet outside the homes that is not a frozen legacy one. */
function newStylesheets(files: readonly string[]): string[] {
  return files
    .filter((file) => STYLESHEET.test(file))
    .filter((file) => !STYLESHEET_HOMES.some((home) => file.startsWith(home)))
    .filter((file) => !LEGACY_STYLESHEETS.has(file));
}

describe('architecture: no new stylesheet', () => {
  it.each([
    'apps/client/web/src/features/watch/components/stage.module.css',
    'packages/client/components/src/page-header/page-header.scss',
    'apps/client/web/src/styles/components/rail.scss',
  ])('fires on %s', (file) => {
    expect(newStylesheets([file])).toEqual([file]);
  });

  it.each([
    'packages/client/ui/src/styles/base.css',
    'docs/design/lib/design.css',
    'apps/client/web/src/index.scss',
    'apps/client/web/src/features/watch/components/stage.tsx',
  ])('leaves %s alone', (file) => {
    expect(newStylesheets([file])).toEqual([]);
  });

  it('lists only legacy stylesheets that still exist, so the list shrinks to empty', () => {
    const tracked = new Set(trackedFiles(...LEGACY_STYLESHEETS));

    expect([...LEGACY_STYLESHEETS].filter((file) => !tracked.has(file))).toEqual([]);
  });

  it('finds no stylesheet outside the homes and the legacy list', () => {
    expect(newStylesheets(trackedFiles())).toEqual([]);
  });
});
