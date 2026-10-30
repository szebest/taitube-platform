import type { TokenGroup } from '@vp/design-tokens';
import { useT } from '@vp/intl-react';
import { Badge, Button } from '@vp/ui';

import { ChoiceCards } from '#app/components/settings/choice-cards';
import { useTokenOverride } from '../hooks/use-token-override';
import { SettingItem } from './setting-item';
import { SetPreview } from './token-group-map';

const THEME_DEFAULT = '';

const nameOf = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

export type TokenGroupRowProps = { group: TokenGroup };

/** One token group: the theme's default, then every set the registry offers, each drawn as what it changes. */
export function TokenGroupRow({ group }: TokenGroupRowProps) {
  const { sets, defaultSet, override, choose, reset } = useTokenOverride(group);
  const { tOr } = useT();
  const label = tOr('settings.rowLabel', { row: group }, '');

  return (
    <SettingItem
      row={group}
      setting={`appearance.overrides.${group}`}
      stacked
      description={tOr('settings.groupDescription', { group }, '')}
    >
      <div className="tw:flex tw:flex-col tw:gap-stack">
        {override !== undefined && (
          <div className="tw:flex tw:items-center tw:gap-inline">
            <Badge variant="soft" tone="accent">
              {tOr('settings.changed', {}, '')}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              aria-label={tOr('settings.resetGroup', { row: label }, '')}
              onClick={reset}
            >
              {tOr('settings.reset', {}, '')}
            </Button>
          </div>
        )}
        <ChoiceCards.Root
          aria-label={label}
          value={override ?? THEME_DEFAULT}
          onValueChange={(id) => (id === THEME_DEFAULT ? reset() : choose(id))}
        >
          <ChoiceCards.Option value={THEME_DEFAULT}>
            <ChoiceCards.Preview>
              <SetPreview group={group} setId={defaultSet.id} />
            </ChoiceCards.Preview>
            <ChoiceCards.Label>
              {tOr('settings.themeDefault', { name: nameOf(defaultSet.id) }, '')}
            </ChoiceCards.Label>
          </ChoiceCards.Option>
          {sets.map(({ id }) => (
            <ChoiceCards.Option key={id} value={id}>
              <ChoiceCards.Preview>
                <SetPreview group={group} setId={id} />
              </ChoiceCards.Preview>
              <ChoiceCards.Label>{nameOf(id)}</ChoiceCards.Label>
            </ChoiceCards.Option>
          ))}
        </ChoiceCards.Root>
      </div>
    </SettingItem>
  );
}
