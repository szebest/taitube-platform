import { useSuspenseQuery } from '@tanstack/react-query';
import { EmptyState, PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { canUpdateCommentSettings } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { commentSettingsQueryOptions, useApi } from '@vp/queries';
import {
  type ModerationChannel,
  ModerationChannelProvider,
} from '#app/features/comments/hooks/use-moderation-channel';
import { DisclosureDefaultsSection } from '../disclosure-defaults-section/disclosure-defaults-section';
import {
  AccountAgeSection,
  SlowModeSection,
  SubscribersOnlySection,
} from '../limit-sections/limit-sections';
import { RestrictionsSection } from '../restrictions-section/restrictions-section';
import { ReviewModeSection } from '../review-mode-section/review-mode-section';
import { SavedRepliesSection } from '../saved-replies-section/saved-replies-section';
import { TagListSection } from '../tag-list-section/tag-list-section';
import { TrustedCommentersSection } from '../trusted-commenters-section/trusted-commenters-section';

function Sections() {
  const { data: settings } = useSuspenseQuery(commentSettingsQueryOptions(useApi()));

  return (
    <div className="flex flex-col gap-stack">
      <ReviewModeSection settings={settings} />
      <TagListSection settings={settings} field="blockedWords" />
      <TagListSection settings={settings} field="linkAllowlist" />
      <SlowModeSection settings={settings} />
      <SubscribersOnlySection settings={settings} />
      <AccountAgeSection settings={settings} />
      <DisclosureDefaultsSection settings={settings} />
      <TrustedCommentersSection />
      <RestrictionsSection />
      <SavedRepliesSection />
    </div>
  );
}

export interface CommentSettingsPageProps {
  channel: ModerationChannel;
}

/** How the channel's comments are moderated, as sections each saved on its own, for the people who change the settings. */
export function CommentSettingsPage({ channel }: CommentSettingsPageProps) {
  const { tOr } = useT();
  const allowed = useCan(canUpdateCommentSettings, { channel });

  return (
    <ModerationChannelProvider channel={channel}>
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.settingsTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      {allowed ? (
        <Sections />
      ) : (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.settingsForbidden', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      )}
    </ModerationChannelProvider>
  );
}
