import { useQuery } from '@tanstack/react-query';
import type { ContentSection } from '@vp/domain';
import { useApi } from '@vp/queries';
import { pagePlaylistsQueryOptions } from '#app/features/page-builder/api/page-sources';
import {
  SOURCE_CHOICES,
  sourceValue,
  withSource,
} from '#app/features/page-builder/utils/content-edits';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { LabelledSelect } from '../labelled-select/labelled-select';

export interface SourceFieldsProps {
  section: ContentSection;
  onChange: (section: ContentSection) => void;
}

/** Where a content section takes its items from: a kind of content, or one of the channel's public playlists. */
export function SourceFields({ section, onChange }: SourceFieldsProps) {
  const { tOr } = useT();
  const { channelId } = useActiveChannel();
  const playlists = useQuery(pagePlaylistsQueryOptions(useApi(), channelId));
  const { source } = section;
  const handPicked =
    source.type === 'picked' || source.type === 'smart_playlist' ? source.type : undefined;

  const options = [
    ...(handPicked
      ? [
          {
            value: sourceValue(section),
            label: tOr('studio.pageSourceOption', { source: handPicked }, ''),
          },
        ]
      : []),
    ...SOURCE_CHOICES.map((source) => ({
      value: source,
      label: tOr('studio.pageSourceOption', { source }, ''),
    })),
    ...(playlists.data ?? []).map(({ id, title }) => ({
      value: `playlist:${id}`,
      label: tOr('studio.pageSourcePlaylist', { title }, ''),
    })),
  ];

  return (
    <LabelledSelect
      label={tOr('studio.pageSourceLabel', {}, '')}
      value={sourceValue(section)}
      options={options}
      onValueChange={(value) => onChange(withSource(section, value))}
    />
  );
}
