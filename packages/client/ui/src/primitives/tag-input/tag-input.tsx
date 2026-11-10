import { type ChangeEvent, type ClipboardEvent, type KeyboardEvent, useState } from 'react';
import { useUiCopy } from '../../copy/ui-copy';
import { cn } from '../../lib/class-names';
import { Chip } from '../chip';
import { Icon } from '../icon';
import { Input, type InputProps } from '../input';

export interface TagInputProps extends Omit<
  InputProps,
  'value' | 'defaultValue' | 'onChange' | 'type'
> {
  value: readonly string[];
  onValueChange: (tags: string[]) => void;
  /** No more tags are taken once the list is this long. */
  max?: number;
}

const SEPARATORS = /[,;\n\t]+/;

const fold = (tag: string) => tag.toLowerCase();

/**
 * A list of short values typed into one field: Enter, a comma or leaving the field ends a tag, a pasted
 * list of lines or commas becomes one tag each, and a tag already in the list is dropped and said so.
 */
export function TagInput({
  value,
  onValueChange,
  max = Number.POSITIVE_INFINITY,
  className,
  onKeyDown,
  onBlur,
  onPaste,
  ...props
}: TagInputProps) {
  const { tagRemove, tagDuplicate } = useUiCopy();
  const [draft, setDraft] = useState('');
  const [repeated, setRepeated] = useState<string>();

  const take = (entries: readonly string[]) => {
    const known = new Set(value.map(fold));
    const added: string[] = [];
    let duplicate: string | undefined;
    for (const entry of entries.map((raw) => raw.trim()).filter((tag) => tag !== '')) {
      if (known.has(fold(entry))) {
        duplicate ??= entry;
      } else if (value.length + added.length < max) {
        known.add(fold(entry));
        added.push(entry);
      }
    }
    setRepeated(duplicate);
    if (added.length > 0) {
      onValueChange([...value, ...added]);
    }
  };

  const change = ({ target }: ChangeEvent<HTMLInputElement>) => {
    if (SEPARATORS.test(target.value)) {
      take(target.value.split(SEPARATORS));
      setDraft('');
      return;
    }
    setRepeated(undefined);
    setDraft(target.value);
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.key === 'Enter') {
      event.preventDefault();
      take([draft]);
      setDraft('');
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onValueChange(value.slice(0, -1));
    }
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event);
    const pasted = event.clipboardData.getData('text');
    if (SEPARATORS.test(pasted)) {
      event.preventDefault();
      take([draft, ...pasted.split(SEPARATORS)]);
      setDraft('');
    }
  };

  return (
    <div data-slot="tag-input" className={cn('flex flex-col gap-inline', className)}>
      {value.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-inline p-0">
          {value.map((tag) => (
            <li key={tag}>
              <Chip
                variant="outline"
                aria-label={tagRemove.replace('{tag}', tag)}
                onClick={() => onValueChange(value.filter((other) => other !== tag))}
              >
                {tag}
                <Icon name="close" size="sm" />
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <Input
        value={draft}
        onChange={change}
        onKeyDown={keyDown}
        onPaste={paste}
        onBlur={(event) => {
          onBlur?.(event);
          take([draft]);
          setDraft('');
        }}
        {...props}
      />
      <p role="status" className="m-0 text-caption text-fg-muted">
        {repeated === undefined ? '' : tagDuplicate.replace('{tag}', repeated)}
      </p>
    </div>
  );
}
