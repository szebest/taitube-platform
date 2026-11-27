import { axeViolations } from '@kit/web-testing/dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DateTimePicker, type DateTimePickerProps } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Field } from '../../field';

function Controlled({ initial, onSeen }: { initial: string; onSeen: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  const change: DateTimePickerProps['onValueChange'] = (next) => {
    setValue(next);
    onSeen(next);
  };

  return (
    <Field.Root>
      <Field.Label>Publish at</Field.Label>
      <DateTimePicker
        value={value}
        onValueChange={change}
        dateLabel="Date"
        timeLabel="Time"
        min="2026-12-01T00:00"
      />
    </Field.Root>
  );
}

function renderPicker(initial = '') {
  const seen: string[] = [];
  return {
    seen,
    ...render(<Controlled initial={initial} onSeen={(v) => seen.push(v)} />, {
      wrapper: WithUiCopy,
    }),
  };
}

describe('@kit/ui: DateTimePicker', () => {
  it('splits its value into a date box and a time box, the field label naming the first', () => {
    renderPicker('2026-12-24T18:30');

    expect(screen.getByLabelText('Publish at')).toHaveValue('2026-12-24');
    expect(screen.getByLabelText('Time')).toHaveValue('18:30');
  });

  it.each([
    { scenario: 'a date', box: 'Date', typed: '2026-12-24', initial: '', expected: '2026-12-24T' },
    { scenario: 'a time', box: 'Time', typed: '18:30', initial: '', expected: 'T18:30' },
    {
      scenario: 'a new time',
      box: 'Time',
      typed: '09:15',
      initial: '2026-12-24T18:30',
      expected: '2026-12-24T09:15',
    },
  ])('speaks one local string when $scenario is typed', ({ box, typed, initial, expected }) => {
    const { seen } = renderPicker(initial);

    fireEvent.change(screen.getByLabelText(box === 'Date' ? 'Publish at' : box), {
      target: { value: typed },
    });

    expect(seen.at(-1)).toBe(expected);
  });

  it('keeps the earliest day on the date box', () => {
    renderPicker();

    expect(screen.getByLabelText('Publish at')).toHaveAttribute('min', '2026-12-01');
  });

  it('passes axe', async () => {
    renderPicker('2026-12-24T18:30');

    expect(await axeViolations()).toEqual([]);
  });
});
