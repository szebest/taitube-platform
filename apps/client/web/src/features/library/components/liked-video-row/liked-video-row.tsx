import { useT } from '@kit/intl-react';
import { DropdownMenu, Icon } from '@kit/ui';
import type { VideoSummary } from '@vp/api-contracts';
import { useUnlikeVideo } from '#app/features/library/hooks/use-unlike-video';
import { LibraryVideoRow } from '../library-video-row/library-video-row';

export interface LikedVideoRowProps {
  video: VideoSummary;
}

/** A liked video as a `row` card; Unlike takes it off the list. */
export function LikedVideoRow({ video }: LikedVideoRowProps) {
  const { tOr } = useT();
  const { mutate } = useUnlikeVideo(video.id);

  return (
    <LibraryVideoRow
      video={video}
      at={video.createdAt}
      actions={
        <DropdownMenu.Item onSelect={() => mutate()}>
          <Icon name="like" />
          {tOr('library.unlike', {}, '')}
        </DropdownMenu.Item>
      }
    />
  );
}
