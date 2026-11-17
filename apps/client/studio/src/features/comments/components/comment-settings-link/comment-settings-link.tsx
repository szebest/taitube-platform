import { useT } from '@kit/intl-react';
import { Button } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import { canUpdateCommentSettings } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
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
