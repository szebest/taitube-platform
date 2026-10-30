import { Chip, cn, Icon, IconButton, Slot, useUiCopy } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ChipBarContext, useChipBar } from './chip-bar.context';
import { CHEVRON_CLASS, ITEM_CLASS, ROOT_CLASS, TRACK_CLASS } from './chip-bar.variants';
import { enterAtFirstItem, moveFocus } from './chip-bar-keyboard';
import { ITEM_SELECTOR, revealInTrack, scrollByChevron } from './chip-bar-track';
import type { ChipBarValue } from './types';
import { useChipBarOverflow } from './use-chip-bar-overflow';
import { useChipBarStuck } from './use-chip-bar-stuck';

export interface ChipBarRootProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'> {
  /** A string selects one chip (radio semantics), an array any number (toggle semantics). */
  value: ChipBarValue;
  onValueChange: (value: ChipBarValue) => void;
}

/** The row of chips above a feed: one tab stop, arrows move, sticky under the header, chevrons when it overflows. */
export function ChipBarRoot({
  value,
  onValueChange,
  className,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: ChipBarRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const overflow = useChipBarOverflow(trackRef);
  const stuck = useChipBarStuck(rootRef);
  const [focusValue, setFocusValue] = useState<string>();
  const { scrollBack, scrollForward } = useUiCopy();
  const multiple = Array.isArray(value);
  const selected = multiple ? value : [value];
  const selectedKey = selected.join('\n');

  const isSelected = (candidate: string) => selected.includes(candidate);

  const select = (candidate: string) => {
    if (!multiple) {
      if (candidate !== value) {
        onValueChange(candidate);
      }
      return;
    }
    onValueChange(
      value.includes(candidate) ? value.filter((kept) => kept !== candidate) : [...value, candidate]
    );
  };

  useEffect(() => {
    const track = trackRef.current;
    if (track === null || selectedKey === '') {
      return;
    }
    const first = track.querySelector(`${ITEM_SELECTOR}[data-selected]`);
    if (first !== null) {
      revealInTrack(track, first);
    }
  }, [selectedKey]);

  const hasTabStop = focusValue !== undefined || selected.length > 0;
  const shared = { value, multiple, isSelected, select, focusValue, setFocusValue };
  const track = {
    ref: trackRef,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    tabIndex: hasTabStop ? undefined : 0,
    'data-slot': 'chip-bar-track',
    className: TRACK_CLASS,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => moveFocus(event, multiple),
    onFocus: enterAtFirstItem,
    children,
  };

  return (
    <ChipBarContext value={shared}>
      <div
        ref={rootRef}
        data-slot="chip-bar"
        data-stuck={stuck || undefined}
        className={cn(ROOT_CLASS, className)}
        {...props}
      >
        {overflow.start && (
          <IconButton
            aria-label={scrollBack}
            tabIndex={-1}
            size="sm"
            className={cn(CHEVRON_CLASS, 'tw:start-0')}
            onClick={() => scrollByChevron(trackRef.current, -1)}
          >
            <Icon name="chevron-left" />
          </IconButton>
        )}
        {multiple ? (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset is no reliable flex scroll track
          <div role="group" {...track} />
        ) : (
          <div role="radiogroup" {...track} />
        )}
        {overflow.end && (
          <IconButton
            aria-label={scrollForward}
            tabIndex={-1}
            size="sm"
            className={cn(CHEVRON_CLASS, 'tw:end-0')}
            onClick={() => scrollByChevron(trackRef.current, 1)}
          >
            <Icon name="chevron-right" />
          </IconButton>
        )}
      </div>
    </ChipBarContext>
  );
}

export interface ChipBarItemProps
  extends Omit<ComponentPropsWithRef<'button'>, 'value' | 'disabled'> {
  value: string;
  /** A finished count, printed in `caption` after the label. */
  count?: string;
  /** Stays focusable while selected, announced through `aria-disabled`. */
  disabled?: boolean;
  /** Styles the router link the caller passes; the selected one carries `aria-current`. */
  asChild?: boolean;
}

export function ChipBarItem({
  value,
  count,
  disabled = false,
  asChild = false,
  className,
  children,
  onClick,
  onFocus,
  ...props
}: ChipBarItemProps) {
  const {
    multiple,
    isSelected,
    select,
    focusValue,
    setFocusValue,
    value: barValue,
  } = useChipBar('Item');
  const selected = isSelected(value);
  const firstSelected = Array.isArray(barValue) ? barValue[0] : barValue;
  const tabStop = (focusValue ?? firstSelected) === value;

  const selection = multiple
    ? asChild
      ? { role: 'checkbox', 'aria-checked': selected }
      : { 'aria-pressed': selected }
    : { role: 'radio', 'aria-checked': selected };

  const choose = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    select(value);
  };

  return (
    <Chip
      data-slot="chip-bar-item"
      data-selected={selected || undefined}
      asChild={asChild}
      aria-disabled={disabled || undefined}
      aria-current={asChild && selected ? 'true' : undefined}
      tabIndex={tabStop ? 0 : -1}
      className={cn(ITEM_CLASS, className)}
      onClick={choose}
      onFocus={(event) => {
        setFocusValue(value);
        onFocus?.(event);
      }}
      {...selection}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      {count !== undefined && (
        <>
          {' '}
          <span className="tw:text-caption tw:tabular-nums">{count}</span>
        </>
      )}
    </Chip>
  );
}
