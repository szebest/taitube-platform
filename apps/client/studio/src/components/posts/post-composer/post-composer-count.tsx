import { cn } from '@kit/ui';
import { useT } from '#app/lib/messages';

export interface PostComposerCountProps {
  length: number;
  max: number;
}

/** How much of a limit a text has used; the figure turns to the danger ink past it. */
export function PostComposerCount({ length, max }: PostComposerCountProps) {
  const { tOr } = useT();

  return (
    <span className={cn('tabular-nums', length > max && 'text-danger-ink')}>
      {tOr('studio.composerCount', { count: length, max }, '')}
    </span>
  );
}
