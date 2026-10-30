import { useNavigate, useRouter } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { assertNever } from '@vp/result';
import { Avatar, Icon } from '@vp/ui';
import type { ReactNode } from 'react';
import { CommandPalette } from '#app/components/shell/command-palette';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useCommandPaletteStore } from '../command-palette-store';
import { type PaletteResult, paletteResultKey } from '../palette-results';
import { playlistHref } from '../playlist-href';
import { MatchedText } from './matched-text';

export interface PaletteResultItemProps {
  result: PaletteResult;
  terms: readonly string[];
}

/** One hit or suggestion of the palette: it opens the page it names, or runs the words it suggests. */
export function PaletteResultItem({ result, terms }: PaletteResultItemProps) {
  const { setOpen } = useCommandPaletteStore();
  const navigate = useNavigate();
  const router = useRouter();
  const { clock } = useDurationText(result.kind === 'video' ? result.video.durationMs : undefined);
  const { tOr } = useT();

  const go = (open: () => void) => {
    setOpen(false);
    open();
  };

  const row = (leading: ReactNode, title: string, meta: string | undefined, open: () => void) => (
    <CommandPalette.Item
      value={paletteResultKey(result)}
      onSelect={() => go(open)}
      leading={leading}
      meta={meta}
    >
      <MatchedText text={title} terms={terms} />
    </CommandPalette.Item>
  );

  switch (result.kind) {
    case 'video': {
      const { video } = result;
      const src = video.thumbnailUrl ?? video.posterUrl;
      return row(
        src ? <img src={src} alt="" /> : <Icon name="video" />,
        video.title ?? tOr('browse.untitled', {}, ''),
        clock,
        () => navigate({ to: '/watch/$videoId', params: { videoId: video.id } })
      );
    }
    case 'channel':
      return row(
        <Avatar.Root size="sm" aria-hidden="true">
          {result.avatarUrl && <Avatar.Image src={result.avatarUrl} alt="" />}
          <Avatar.Fallback>{result.name.slice(0, 1)}</Avatar.Fallback>
        </Avatar.Root>,
        result.name,
        result.subscriberCount === undefined
          ? tOr('channels.handle', { handle: result.handle }, '')
          : tOr('channels.subscribers', { count: result.subscriberCount }, ''),
        () => navigate({ to: '/channel/$channelId', params: { channelId: result.id } })
      );
    case 'playlist': {
      const { playlist } = result;
      return row(
        <Icon name="playlist" />,
        playlist.title,
        tOr('search.playlistVideos', { count: playlist.videoCount }, ''),
        () => router.history.push(playlistHref(playlist.id))
      );
    }
    case 'query':
      return row(<Icon name="search" />, result.text, undefined, () =>
        navigate({ to: '/search', search: { q: result.text } })
      );
    default:
      return assertNever(result, 'palette result');
  }
}
