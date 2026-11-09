import type { ChannelRole } from '@vp/domain';
import { Badge, type BadgeProps, type BadgeTone } from '@vp/ui';

const TONE: Record<ChannelRole, BadgeTone> = {
  manager: 'accent',
  editor: 'info',
  moderator: 'warning',
  analytics: 'neutral',
};

export interface RoleBadgeProps extends Omit<BadgeProps, 'tone'> {
  channelRole: ChannelRole;
}

/** A member's role as a label; the tone tells the four roles apart, the word is the role. */
export function RoleBadge({ channelRole, ...props }: RoleBadgeProps) {
  return <Badge variant="soft" tone={TONE[channelRole]} data-role={channelRole} {...props} />;
}
