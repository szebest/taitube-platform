import { useT } from '@vp/intl-react';
import { useAppearance } from '@vp/ui';

import { ChoiceCards } from '#app/components/settings/choice-cards';
import { SettingItem } from './setting-item';

/** The theme's colours drawn by the theme's own stylesheet, so a registered theme looks like itself with no edit here. */
function ThemeSwatches({ themeId }: { themeId: string }) {
  const { shownMode } = useAppearance();

  return (
    <div
      data-theme={themeId}
      data-mode={shownMode}
      className="tw:flex tw:items-center tw:gap-inline tw:rounded-control tw:border-divider tw:border-border tw:bg-bg tw:p-inset-control"
    >
      <span className="tw:text-title tw:text-fg">Aa</span>
      <span className="tw:size-4 tw:rounded-full tw:bg-surface tw:ring-1 tw:ring-border" />
      <span className="tw:size-4 tw:rounded-full tw:bg-accent" />
      <span className="tw:size-4 tw:rounded-full tw:bg-fg-muted" />
    </div>
  );
}

/** One card per theme the engine offers, the registry's and those registered at runtime. */
export function ThemeRow() {
  const { resolved, themes, update } = useAppearance();
  const { tOr } = useT();

  return (
    <SettingItem
      row="theme"
      setting="appearance.theme"
      stacked
      description={tOr('settings.rowDescription', { row: 'theme' }, '')}
    >
      <ChoiceCards.Root
        aria-label={tOr('settings.rowLabel', { row: 'theme' }, '')}
        value={resolved.theme.id}
        onValueChange={(theme) => update({ theme })}
      >
        {themes.map(({ id, name }) => (
          <ChoiceCards.Option key={id} value={id}>
            <ChoiceCards.Preview>
              <ThemeSwatches themeId={id} />
            </ChoiceCards.Preview>
            <ChoiceCards.Label>{name}</ChoiceCards.Label>
          </ChoiceCards.Option>
        ))}
      </ChoiceCards.Root>
    </SettingItem>
  );
}
