import type { CommentSettingsView } from '@vp/api-contracts';
import { REVIEW_MODES, type ReviewMode } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { SegmentedControl } from '@vp/ui';
import { useSettingsSection } from '#app/features/comments/hooks/use-settings-section';
import { SettingsSection } from '../settings-section/settings-section';

const KEYS = ['reviewMode'] as const;

const isMode = (value: string): value is ReviewMode => REVIEW_MODES.some((mode) => mode === value);

/** What the channel holds for review before anyone else sees it. */
export function ReviewModeSection({ settings }: { settings: CommentSettingsView }) {
  const { tOr } = useT();
  const section = useSettingsSection(settings, KEYS);

  return (
    <SettingsSection
      title={tOr('studio.settingsReviewTitle', {}, '')}
      description={tOr('studio.settingsReviewDescription', {}, '')}
      section={section}
    >
      <SegmentedControl.Root
        aria-label={tOr('studio.settingsReviewLabel', {}, '')}
        value={section.draft.reviewMode}
        onValueChange={(mode) => isMode(mode) && section.change({ reviewMode: mode })}
      >
        {REVIEW_MODES.map((mode) => (
          <SegmentedControl.Item key={mode} value={mode}>
            {tOr('studio.settingsReviewOption', { mode }, '')}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </SettingsSection>
  );
}
