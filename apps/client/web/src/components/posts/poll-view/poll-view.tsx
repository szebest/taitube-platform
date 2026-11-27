import { Button, cn, Icon, Progress, VisuallyHidden } from '@kit/ui';
import { type ComponentPropsWithRef, useId } from 'react';
import { useT } from '#app/lib/messages';
import { PollViewContext, usePollView } from './poll-view.context';

export interface PollViewRootProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange'> {
  question: string;
  /** Results show: the viewer voted or the poll closed. Votes before that are hidden and options are buttons. */
  revealed: boolean;
  votedIndex: number | null;
  /** A quiz's right option once it is known, else null. */
  correctIndex?: number | null;
  /** The viewer cannot vote now: a guest, a closed poll, or a vote in flight. */
  voteDisabled?: boolean;
  onVote: (index: number) => void;
}

/** A poll or a quiz: the question, its options and, once revealed, the share each one took. */
export function PollViewRoot({
  question,
  revealed,
  votedIndex,
  correctIndex = null,
  voteDisabled = false,
  onVote,
  className,
  children,
  ...props
}: PollViewRootProps) {
  const questionId = useId();

  return (
    <PollViewContext
      value={{ revealed, votedIndex, correctIndex, voteDisabled, questionId, onVote }}
    >
      <div
        data-slot="poll-view"
        data-revealed={revealed}
        role="group"
        aria-labelledby={questionId}
        className={cn('flex flex-col gap-stack', className)}
        {...props}
      >
        <p id={questionId} className="m-0 text-title">
          {question}
        </p>
        {children}
      </div>
    </PollViewContext>
  );
}

export function PollViewOptions({ className, ...props }: ComponentPropsWithRef<'ul'>) {
  return (
    <ul
      data-slot="poll-view-options"
      className={cn('m-0 flex list-none flex-col gap-inline p-0', className)}
      {...props}
    />
  );
}

export interface PollViewOptionProps extends Omit<ComponentPropsWithRef<'li'>, 'children'> {
  index: number;
  text: string;
  /** Null while results are hidden. */
  votes: number | null;
  /** 0 to 100, the option's share of the votes. */
  share: number;
}

function optionState(index: number, votedIndex: number | null, correctIndex: number | null) {
  if (index === correctIndex) {
    return 'correct';
  }

  return index === votedIndex ? 'chosen' : 'plain';
}

export function PollViewOption({
  index,
  text,
  votes,
  share,
  className,
  ...props
}: PollViewOptionProps) {
  const { revealed, votedIndex, correctIndex, voteDisabled, onVote } = usePollView('Option');
  const { tOr } = useT();
  const state = optionState(index, votedIndex, correctIndex);

  if (!revealed) {
    return (
      <li data-slot="poll-view-option" data-state="open" className={className} {...props}>
        <Button
          variant="outline"
          tone="neutral"
          className="w-full justify-start"
          disabled={voteDisabled}
          onClick={() => onVote(index)}
        >
          {text}
        </Button>
      </li>
    );
  }

  return (
    <li
      data-slot="poll-view-option"
      data-state={state}
      className={cn('flex flex-col gap-1', className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-stack text-body">
        <span className="flex min-w-0 items-center gap-inline">
          {state === 'correct' && <Icon name="check" tone="accent" />}
          <span className={cn('break-words', state !== 'plain' && 'text-label')}>{text}</span>
          {state === 'correct' && (
            <VisuallyHidden>{tOr('posts.correctAnswer', {}, '')}</VisuallyHidden>
          )}
          {state === 'chosen' && (
            <span className="text-caption text-fg-muted">{tOr('posts.yourVote', {}, '')}</span>
          )}
        </span>
        <span className="shrink-0 text-mono font-mono">
          {tOr('posts.optionShare', { percent: share }, '')}
          {votes !== null && (
            <VisuallyHidden> {tOr('posts.pollVotes', { count: votes }, '')}</VisuallyHidden>
          )}
        </span>
      </div>
      <Progress
        aria-label={text}
        value={share}
        size="md"
        tone={state === 'plain' ? 'neutral' : 'accent'}
      />
    </li>
  );
}

export function PollViewFooter({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="poll-view-footer"
      className={cn('m-0 flex flex-wrap gap-x-stack text-caption text-fg-muted', className)}
      {...props}
    />
  );
}

/** A quiz's explanation, which the API holds back until the viewer answered or it closed. */
export function PollViewExplanation({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="poll-view-explanation"
      className={cn('m-0 rounded-card bg-accent-soft p-inset-control text-body', className)}
      {...props}
    />
  );
}
