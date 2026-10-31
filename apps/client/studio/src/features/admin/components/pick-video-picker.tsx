import { useT } from '@vp/intl-react';
import { Command, Field, Icon } from '@vp/ui';
import { useState } from 'react';

import type { PickableVideo, PickVideo } from '#app/features/admin/api/pick-videos';
import { usePickableVideos } from '#app/features/admin/hooks/use-pickable-videos';

export interface PickVideoPickerProps {
  selected: PickVideo | null;
  onSelect: (video: PickableVideo) => void;
  /** Shown under the picker when the draft has no video, or the API refused the one chosen. */
  error: string | undefined;
}

/** A `Command` over the public, ready videos: type to narrow by title, arrow to move, Enter to choose. */
export function PickVideoPicker({ selected, onSelect, error }: PickVideoPickerProps) {
  const { tOr } = useT();
  const [text, setText] = useState('');
  const videos = usePickableVideos(text);
  const label = tOr('studio.pickVideoSearch', {}, '');

  return (
    <Field.Root invalid={error !== undefined}>
      <Field.Label>{tOr('studio.pickVideo', {}, '')}</Field.Label>
      <Command.Root
        shouldFilter={false}
        label={label}
        className="tw:rounded-control tw:border-divider tw:border-border"
      >
        <Field.Control>
          <Command.Input value={text} onValueChange={setText} placeholder={label} />
        </Field.Control>
        <Command.List>
          {videos.isPending && (
            <Command.Empty>{tOr('studio.pickVideoLoading', {}, '')}</Command.Empty>
          )}
          {videos.isError && <Command.Empty>{tOr('studio.pickVideoFailed', {}, '')}</Command.Empty>}
          {videos.data?.length === 0 && (
            <Command.Empty>{tOr('studio.pickVideoNone', {}, '')}</Command.Empty>
          )}
          {videos.data?.map((video) => (
            <Command.Item
              key={video.id}
              value={video.id}
              keywords={[video.title ?? '']}
              onSelect={() => onSelect(video)}
              aria-selected={video.id === selected?.id}
            >
              <span className="tw:min-w-0 tw:flex-1 tw:truncate">
                {video.title ?? tOr('studio.pickUntitled', {}, '')}
              </span>
              {video.id === selected?.id && <Icon name="check" size="sm" />}
            </Command.Item>
          ))}
        </Command.List>
      </Command.Root>
      {selected && (
        <Field.Hint>
          {tOr(
            'studio.pickVideoChosen',
            { title: selected.title ?? tOr('studio.pickUntitled', {}, '') },
            ''
          )}
        </Field.Hint>
      )}
      {error !== undefined && <Field.Error>{error}</Field.Error>}
    </Field.Root>
  );
}
