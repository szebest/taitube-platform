import { type ComponentPropsWithRef, useId } from 'react';
import { cn } from '../../lib/class-names';
import { Input, type InputSize } from '../input';

export interface DateTimePickerProps extends Omit<
  ComponentPropsWithRef<'div'>,
  'onChange' | 'defaultValue'
> {
  /** A local `YYYY-MM-DDTHH:mm`; while the person is typing either half may be empty, and `''` is neither. */
  value: string;
  onValueChange: (value: string) => void;
  /** Names the date box, since the primitive prints no words. */
  dateLabel: string;
  /** Names the time box. */
  timeLabel: string;
  /** The earliest local `YYYY-MM-DDTHH:mm`; its date bounds the date box. */
  min?: string;
  size?: InputSize;
  disabled?: boolean;
}

const DATE_LENGTH = 10;

const join = (date: string, time: string) => (date || time ? `${date}T${time}` : '');

/** The browser's own date and time boxes side by side, so the keyboard, the picker and the locale are the platform's; it speaks one local string. */
export function DateTimePicker({
  value,
  onValueChange,
  dateLabel,
  timeLabel,
  min,
  size,
  disabled,
  className,
  ...props
}: DateTimePickerProps) {
  const timeId = useId();
  const [date = '', time = ''] = value.split('T');

  return (
    <div
      role="group"
      data-slot="date-time-picker"
      className={cn('flex flex-wrap gap-inline', className)}
      {...props}
    >
      <Input
        type="date"
        size={size}
        disabled={disabled}
        aria-label={dateLabel}
        min={min?.slice(0, DATE_LENGTH)}
        value={date}
        onChange={(event) => onValueChange(join(event.target.value, time))}
      />
      <Input
        id={timeId}
        type="time"
        size={size}
        disabled={disabled}
        aria-label={timeLabel}
        value={time}
        onChange={(event) => onValueChange(join(date, event.target.value))}
      />
    </div>
  );
}
