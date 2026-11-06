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
      className="flex items-center gap-inline rounded-control border-divider border-border bg-bg p-inset-control"
    >
      <span className="text-title text-fg">Aa</span>
      <span className="size-4 rounded-full bg-surface ring-1 ring-border" />
      <span className="size-4 rounded-full bg-accent" />
      <span className="size-4 rounded-full bg-fg-muted" />
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
