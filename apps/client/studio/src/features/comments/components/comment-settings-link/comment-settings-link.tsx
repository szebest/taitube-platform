import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { canUpdateCommentSettings } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { Button } from '@vp/ui';
import { useModerationChannel } from '#app/features/comments/hooks/use-moderation-channel';

/** The way to the comment settings, for the people who may change them. */
export function CommentSettingsLink() {
  const { tOr } = useT();
  const channel = useModerationChannel();

  return (
    useCan(canUpdateCommentSettings, { channel }) && (
      <Button asChild variant="outline">
        <Link to="/comments/settings">{tOr('studio.settingsLink', {}, '')}</Link>
      </Button>
    )
  );
}
