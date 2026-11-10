import type { CommentSettingsView } from '@vp/api-contracts';
import { DisclosureControl } from '@vp/components';
import { DISCLOSURE_RULES, type DisclosureRule } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useId } from 'react';
import { useSettingsSection } from '#app/features/comments/hooks/use-settings-section';
import { SettingsSection } from '../settings-section/settings-section';

const KEYS = ['disclosure'] as const;

const kindOf = (rule: DisclosureRule) =>
  rule === 'hide' || rule === 'remove' ? rule : ('hold' as const);

function DefaultRow({
  rule,
  section,
}: {
  rule: DisclosureRule;
  section: ReturnType<typeof useSettingsSection<'disclosure'>>;
}) {
  const { tOr } = useT();
  const noteId = useId();
  const disclosure = section.draft.disclosure[rule];

  return (
    <div className="flex flex-col gap-inline">
      <div className="flex flex-wrap items-center justify-between gap-inline">
        <span className="text-label">{tOr('studio.settingsDefaultRule', { rule }, '')}</span>
        <DisclosureControl
          aria-describedby={noteId}
          value={disclosure}
          onValueChange={(next) =>
            section.change({ disclosure: { ...section.draft.disclosure, [rule]: next } })
          }
        />
      </div>
      <p id={noteId} className="m-0 text-caption text-fg-muted">
        {tOr('studio.settingsDefaultSeen', { seen: `${kindOf(rule)}_${disclosure}` }, '')}
      </p>
    </div>
  );
}

/** For each action and automatic hold, whether the author is told: one Silent or Visible each, with what the author sees. */
export function DisclosureDefaultsSection({ settings }: { settings: CommentSettingsView }) {
  const { tOr } = useT();
  const section = useSettingsSection(settings, KEYS);

  return (
    <SettingsSection
      title={tOr('studio.settingsDefaultsTitle', {}, '')}
      description={tOr('studio.settingsDefaultsDescription', {}, '')}
      section={section}
    >
      {DISCLOSURE_RULES.map((rule) => (
        <DefaultRow key={rule} rule={rule} section={section} />
      ))}
    </SettingsSection>
  );
}
