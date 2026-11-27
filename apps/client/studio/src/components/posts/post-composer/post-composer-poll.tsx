import {
  Button,
  Callout,
  DateTimePicker,
  Field,
  Icon,
  IconButton,
  Input,
  Tabs,
  Textarea,
} from '@kit/ui';
import { useId } from 'react';
import { useT } from '#app/lib/messages';
import { POST_LIMITS } from './constants';
import { PostComposerCount } from './post-composer-count';
import { usePostComposer } from './post-composer.context';

function PollFields({ quiz }: { quiz: boolean }) {
  const { tOr } = useT();
  const { draft, pollLocked, change } = usePostComposer(quiz ? 'Quiz' : 'Poll');
  const group = useId();
  const { options } = draft;
  const setOption = (index: number, text: string) =>
    change({ options: options.map((option, at) => (at === index ? text : option)) });
  const removeOption = (index: number) =>
    change({
      options: options.filter((_, at) => at !== index),
      correctIndex:
        index < draft.correctIndex
          ? draft.correctIndex - 1
          : Math.min(draft.correctIndex, options.length - 2),
    });

  return (
    <div className="flex flex-col gap-stack">
      {pollLocked && (
        <Callout.Root tone="warning" role="status">
          <Callout.Icon />
          <Callout.Title>{tOr('studio.composerPollLockedTitle', {}, '')}</Callout.Title>
          <Callout.Body>{tOr('studio.composerPollLockedBody', {}, '')}</Callout.Body>
        </Callout.Root>
      )}
      <Field.Root required invalid={draft.question.length > POST_LIMITS.question}>
        <Field.Label>{tOr('studio.composerQuestion', {}, '')}</Field.Label>
        <Input
          value={draft.question}
          disabled={pollLocked}
          onChange={(event) => change({ question: event.target.value })}
        />
        <Field.Hint>
          <PostComposerCount length={draft.question.length} max={POST_LIMITS.question} />
        </Field.Hint>
      </Field.Root>
      <fieldset className="m-0 flex flex-col gap-inline border-0 p-0">
        <legend className="mb-1 text-label">{tOr('studio.composerOptions', {}, '')}</legend>
        {options.map((option, index) => {
          const position = index + 1;

          return (
            <div key={position} className="flex items-center gap-stack">
              {quiz && (
                <input
                  type="radio"
                  name={group}
                  className="size-4 shrink-0 accent-accent focus-ring"
                  checked={draft.correctIndex === index}
                  onChange={() => change({ correctIndex: index })}
                  aria-label={tOr('studio.composerCorrect', { position }, '')}
                />
              )}
              <Input
                aria-label={tOr('studio.composerOption', { position }, '')}
                value={option}
                disabled={pollLocked}
                aria-invalid={option.length > POST_LIMITS.option}
                onChange={(event) => setOption(index, event.target.value)}
              />
              <IconButton
                size="sm"
                aria-label={tOr('studio.composerOptionRemove', { position }, '')}
                disabled={pollLocked || options.length <= POST_LIMITS.optionsMin}
                onClick={() => removeOption(index)}
              >
                <Icon name="close" />
              </IconButton>
            </div>
          );
        })}
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={pollLocked || options.length >= POST_LIMITS.optionsMax}
            onClick={() => change({ options: [...options, ''] })}
          >
            <Icon name="plus" />
            {tOr('studio.composerOptionAdd', {}, '')}
          </Button>
        </div>
      </fieldset>
      {quiz && (
        <Field.Root>
          <Field.Label>{tOr('studio.composerExplanation', {}, '')}</Field.Label>
          <Textarea
            autoGrow
            value={draft.explanation}
            onChange={(event) => change({ explanation: event.target.value })}
          />
          <Field.Hint>
            <PostComposerCount length={draft.explanation.length} max={POST_LIMITS.explanation} />
          </Field.Hint>
        </Field.Root>
      )}
      <Field.Root>
        <Field.Label>{tOr('studio.composerClosesAt', {}, '')}</Field.Label>
        <DateTimePicker
          value={draft.closesAt}
          onValueChange={(closesAt) => change({ closesAt })}
          dateLabel={tOr('studio.composerDate', {}, '')}
          timeLabel={tOr('studio.composerTime', {}, '')}
        />
        <Field.Hint>{tOr('studio.composerClosesHint', {}, '')}</Field.Hint>
        {draft.closesAt && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => change({ closesAt: '' })}>
              {tOr('studio.composerClosesClear', {}, '')}
            </Button>
          </div>
        )}
      </Field.Root>
    </div>
  );
}

/** A question with two to six options and an optional close time. */
export function PostComposerPoll() {
  return (
    <Tabs.Panel value="poll">
      <PollFields quiz={false} />
    </Tabs.Panel>
  );
}

/** The same with the right option marked and an explanation shown after answering. */
export function PostComposerQuiz() {
  return (
    <Tabs.Panel value="quiz">
      <PollFields quiz />
    </Tabs.Panel>
  );
}
