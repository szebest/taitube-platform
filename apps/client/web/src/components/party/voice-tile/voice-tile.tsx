import { Avatar } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { useT } from '#app/lib/messages';

/** The ring around an avatar while its owner speaks: eased on the motion tokens, a plain marker when motion is reduced. */
export const SPEAKING_RING =
  'rounded-full ring-0 ring-accent transition-shadow duration-fast ease-standard data-speaking:ring-2 motion-reduce:transition-none';

export function VoiceTileList({ className, ...props }: ComponentPropsWithRef<'ul'>) {
  const { tOr } = useT();

  return (
    <ul
      data-slot="voice-tile-list"
      aria-label={tOr('party.voiceTiles', {}, '')}
      className={`m-0 flex list-none flex-wrap gap-inline p-0 ${className ?? ''}`}
      {...props}
    />
  );
}

export interface VoiceTileProps extends ComponentPropsWithRef<'li'> {
  name: string;
  avatarUrl?: string | null;
  speaking: boolean;
  muted: boolean;
}

export function VoiceTile({
  name,
  avatarUrl,
  speaking,
  muted,
  className,
  ...props
}: VoiceTileProps) {
  const { tOr } = useT();

  return (
    <li
      data-slot="voice-tile"
      className={`flex w-16 flex-col items-center gap-1 ${className ?? ''}`}
      {...props}
    >
      <Avatar.Root
        size="md"
        aria-hidden="true"
        data-speaking={speaking || undefined}
        className={SPEAKING_RING}
      >
        {avatarUrl && <Avatar.Image src={avatarUrl} alt="" />}
        <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <span className="max-w-full truncate text-caption">{name}</span>
      {muted && (
        <span className="text-caption text-fg-muted">{tOr('party.voiceMuted', {}, '')}</span>
      )}
    </li>
  );
}
