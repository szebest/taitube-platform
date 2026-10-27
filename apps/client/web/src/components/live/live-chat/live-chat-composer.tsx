import { Icon, IconButton, Textarea, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, type FormEvent, type KeyboardEvent, useState } from 'react';

import { useLiveChat } from './live-chat.context';
import { liveChatStyles } from './live-chat.variants';

const COUNTER_FROM = 0.8;

export interface LiveChatComposerProps extends Omit<ComponentPropsWithRef<'form'>, 'onSubmit'> {
  maxLength?: number;
  /** Slow mode: the finished countdown line, while the composer waits. */
  wait?: string;
  disabled?: boolean;
}

/** One row that grows; Enter sends, Shift Enter breaks the line, Escape leaves the field. */
export function LiveChatComposer({
  maxLength,
  wait,
  disabled = false,
  className,
  ...props
}: LiveChatComposerProps) {
  const { layout, onSend } = useLiveChat('Composer');
  const { chatPlaceholder, send } = useUiCopy();
  const [text, setText] = useState('');
  const styles = liveChatStyles({ layout });
  const blocked = disabled || wait !== undefined;
  const showCounter = maxLength !== undefined && text.length >= maxLength * COUNTER_FROM;

  const submit = () => {
    const words = text.trim();
    if (!words || blocked) {
      return;
    }
    onSend(words);
    setText('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Escape') {
      event.currentTarget.blur();
    }
  };

  return (
    <form
      data-slot="live-chat-composer"
      className={styles.composer({ className })}
      onSubmit={handleSubmit}
      {...props}
    >
      <div className={styles.composerRow()}>
        <Textarea
          size="sm"
          rows={1}
          autoGrow
          aria-label={chatPlaceholder}
          placeholder={chatPlaceholder}
          maxLength={maxLength}
          value={text}
          disabled={blocked}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          className={styles.input()}
        />
        <IconButton type="submit" aria-label={send} disabled={blocked || !text.trim()}>
          <Icon name="chevron-right" />
        </IconButton>
      </div>
      {wait !== undefined && <p className={styles.composerNote()}>{wait}</p>}
      {showCounter && (
        <p className={styles.composerNote()} aria-live="polite">
          {text.length} / {maxLength}
        </p>
      )}
    </form>
  );
}
