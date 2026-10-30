import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { Badge, type BadgeTone, Icon, type IconId } from '@vp/ui';

type VideoStatus = VideoSummary['status'];

const STATUS_LOOK = {
  UPLOADING: { tone: 'neutral', icon: 'upload' },
  UPLOADED: { tone: 'neutral', icon: 'clock' },
  PROBING: { tone: 'neutral', icon: 'clock' },
  PROCESSING: { tone: 'info', icon: 'clock' },
  READY: { tone: 'success', icon: 'check' },
  FAILED: { tone: 'danger', icon: 'alert' },
  REJECTED: { tone: 'danger', icon: 'shield' },
  ABANDONED: { tone: 'warning', icon: 'alert' },
  DELETED: { tone: 'neutral', icon: 'trash' },
} as const satisfies Record<VideoStatus, { tone: BadgeTone; icon: IconId }>;

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  const { tOr } = useT();
  const { tone, icon } = STATUS_LOOK[status];

  return (
    <Badge size="sm" tone={tone}>
      <Icon name={icon} size="sm" />
      {tOr('studio.videoStatus', { status }, '')}
    </Badge>
  );
}
