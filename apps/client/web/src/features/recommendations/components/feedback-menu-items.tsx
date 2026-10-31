import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { DropdownMenu, Icon } from '@vp/ui';

import { useRecommendationFeedback } from '../hooks/use-recommendation-feedback';

export interface FeedbackMenuItemsProps {
  video: Pick<VideoSummary, 'id' | 'channel'>;
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
