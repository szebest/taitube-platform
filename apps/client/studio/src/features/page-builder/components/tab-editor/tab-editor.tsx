import { Button, Field, Input, Switch, Textarea } from '@kit/ui';
import { type ChannelLayout, type CustomTab, LAYOUT_LIMITS, type LayoutTab } from '@vp/domain';
import {
  canAddTab,
  isPinnedTab,
  renameTab,
  setLanding,
  setTabHidden,
  updateCustomTab,
} from '#app/features/page-builder/utils/layout-edits';
import { useT } from '#app/lib/messages';
import { LabelledSelect } from '../labelled-select/labelled-select';

export const TAB_ICONS = [
  'video',
  'playlist',
  'chat',
  'live',
  'heart',
  'flame',
  'party',
  'tag',
  'globe',
] as const;

const NO_ICON = 'none';

export interface TabEditorProps {
  layout: ChannelLayout;
  tab: LayoutTab;
  onChange: (layout: ChannelLayout) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function CustomFields({
  tab,
  layout,
  onChange,
}: Pick<TabEditorProps, 'layout' | 'onChange'> & { tab: CustomTab }) {
  const { tOr } = useT();
  const change = (changes: Parameters<typeof updateCustomTab>[2]) =>
    onChange(updateCustomTab(layout, tab.id, changes));

  return (
    <>
      <Field.Root>
        <Field.Label>{tOr('studio.pageTabSlug', {}, '')}</Field.Label>
        <Input
          maxLength={30}
          value={tab.slug}
          onChange={({ target }) => change({ slug: target.value.toLowerCase() })}
        />
        <Field.Hint>{tOr('studio.pageTabSlugHint', {}, '')}</Field.Hint>
      </Field.Root>
      <LabelledSelect
        label={tOr('studio.pageTabIcon', {}, '')}
        value={tab.icon ?? NO_ICON}
        options={[
          { value: NO_ICON, label: tOr('studio.pageTabIconNone', {}, '') },
          ...TAB_ICONS.map((icon) => ({
            value: icon,
            label: tOr('studio.pageTabIconOption', { kind: icon }, ''),
          })),
        ]}
        onValueChange={(icon) => change({ icon: icon === NO_ICON ? null : icon })}
      />
      <Field.Root>
        <Field.Label>{tOr('studio.pageTabDescription', {}, '')}</Field.Label>
        <Textarea
          rows={3}
          maxLength={LAYOUT_LIMITS.tabDescription}
          value={tab.description ?? ''}
          onChange={({ target }) =>
            change({ description: target.value === '' ? null : target.value })
          }
        />
      </Field.Root>
    </>
  );
}

/** The settings of the selected tab: its name, whether it shows, who lands on it and, for a custom tab, its address. */
export function TabEditor({ layout, tab, onChange, onDuplicate, onRemove }: TabEditorProps) {
  const { tOr } = useT();
  const pinned = isPinnedTab(tab);

  return (
    <div className="flex flex-col gap-stack">
      <Field.Root>
        <Field.Label>{tOr('studio.pageTabTitle', {}, '')}</Field.Label>
        <Input
          maxLength={LAYOUT_LIMITS.tabTitle}
          value={tab.title}
          onChange={({ target }) => onChange(renameTab(layout, tab.id, target.value))}
        />
      </Field.Root>
      <Field.Root orientation="horizontal">
        <Field.Label>{tOr('studio.pageTabHide', {}, '')}</Field.Label>
        <Switch
          checked={tab.hidden}
          disabled={pinned}
          onCheckedChange={(hidden) => onChange(setTabHidden(layout, tab.id, hidden))}
        />
      </Field.Root>
      {(['visitor', 'subscriber'] as const).map((audience) => (
        <Field.Root key={audience} orientation="horizontal">
          <Field.Label>{tOr('studio.pageTabLanding', { audience }, '')}</Field.Label>
          <Switch
            checked={layout.landing[audience] === tab.id}
            disabled={layout.landing[audience] === tab.id || tab.hidden}
            onCheckedChange={() => onChange(setLanding(layout, audience, tab.id))}
          />
        </Field.Root>
      ))}
      {tab.kind === 'custom' && (
        <>
          <CustomFields tab={tab} layout={layout} onChange={onChange} />
          <div className="flex gap-inline">
            <Button variant="outline" disabled={!canAddTab(layout)} onClick={onDuplicate}>
              {tOr('studio.pageTabDuplicate', {}, '')}
            </Button>
            <Button variant="outline" tone="danger" onClick={onRemove}>
              {tOr('studio.pageTabRemove', {}, '')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
