import type { ComponentPropsWithRef } from 'react';
import { useT } from '#app/lib/messages';
import { ROOM_ACCENT_SWATCHES } from './constants';

export interface RoomAccentPickerProps extends Omit<
  ComponentPropsWithRef<'div'>,
  'onChange' | 'value'
> {
  /** The room's `#rrggbb`, or `null` for none. */
  value: string | null;
  onChange: (accent: string | null) => void;
}

/** The room's accent: a swatch, any colour, or none. It recolours the room's accent roles only. */
export function RoomAccentPicker({ value, onChange, className, ...props }: RoomAccentPickerProps) {
  const { tOr } = useT();

  return (
    <div
      data-slot="room-accent-picker"
      role="radiogroup"
      aria-label={tOr('party.accentTitle', {}, '')}
      className={`flex flex-wrap items-center gap-inline ${className ?? ''}`}
      {...props}
    >
      {ROOM_ACCENT_SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          role="radio"
          aria-checked={value === swatch}
          aria-label={swatch}
          className="size-6 cursor-pointer rounded-full border-2 border-transparent focus-ring aria-checked:border-fg"
          style={{ backgroundColor: swatch }}
          onClick={() => onChange(swatch)}
        />
      ))}
      <input
        type="color"
        aria-label={tOr('party.accentCustom', {}, '')}
        value={value ?? '#808080'}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        className="cursor-pointer text-body-sm underline focus-ring"
        onClick={() => onChange(null)}
      >
        {tOr('party.accentNone', {}, '')}
      </button>
    </div>
  );
}
