import { DropdownMenu, Icon } from '@kit/ui';
import type { VideoSummary } from '@vp/api-contracts';
import { useRecommendationFeedback } from '#app/hooks/use-recommendation-feedback';
import { useT } from '#app/lib/messages';

export interface FeedbackMenuItemsProps {
  video: { id: string; channel: VideoSummary['channel'] };
}

/** The two ways to say "not this" on a recommended card, for the card's `VideoCard.Menu`. */
export function FeedbackMenuItems({ video }: FeedbackMenuItemsProps) {
  const { tOr } = useT();
  const { hideVideo, hideChannel } = useRecommendationFeedback();
  const { channel } = video;

  return (
    <>
      <DropdownMenu.Item onSelect={() => hideVideo(video.id)}>
        <Icon name="eye-off" />
        {tOr('home.notInterested', {}, '')}
      </DropdownMenu.Item>
      {channel && (
        <DropdownMenu.Item onSelect={() => hideChannel(channel.id)}>
          <Icon name="eye-off" />
          {tOr('home.hideChannel', {}, '')}
        </DropdownMenu.Item>
      )}
    </>
  );
}
