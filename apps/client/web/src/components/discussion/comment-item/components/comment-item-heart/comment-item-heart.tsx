import { Icon, IconButton, useUiCopy } from '@vp/ui';

export interface CommentItemHeartProps {
  hearted: boolean;
  /** Given only to the video's owner, who toggles the heart; everyone else sees it once given. */
  onToggle?: (hearted: boolean) => void;
}

/** The creator's heart: a toggle for the video's owner, a badge for everyone else. */
export function CommentItemHeart({ hearted, onToggle }: CommentItemHeartProps) {
  const { heartComment, heartedByCreator } = useUiCopy();
  const tone = hearted ? 'danger' : 'inherit';
  const fill = hearted ? 'fill-current' : undefined;

  if (onToggle) {
    return (
      <IconButton
        size="sm"
        aria-label={heartComment}
        aria-pressed={hearted}
        onClick={() => onToggle(!hearted)}
      >
        <Icon name="heart" tone={tone} className={fill} />
      </IconButton>
    );
  }

  if (!hearted) {
    return null;
  }

  return (
    <span data-slot="comment-item-heart" className="inline-flex items-center px-inline">
      <Icon name="heart" size="sm" tone={tone} className={fill} aria-label={heartedByCreator} />
    </span>
  );
}
