import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { useState } from 'react';
import { ModerationQueue } from '../index';

function Queue({ selected = [] }: { selected?: string[] }) {
  const [active, setActive] = useState<string | undefined>('one');

  return (
    <ModerationQueue.Root
      aria-label="Held comments"
      active={active}
      onActiveChange={setActive}
      selected={new Set(selected)}
    >
      {['one', 'two', 'three'].map((id) => (
        <ModerationQueue.Item key={id} value={id}>
          {id}
        </ModerationQueue.Item>
      ))}
    </ModerationQueue.Root>
  );
}

const option = (name: string) => screen.getByRole('option', { name });

describe('apps/client/studio: ModerationQueue', () => {
  it('puts only the active option in the tab order', () => {
    render(<Queue />);

    expect(screen.getAllByRole('option').map((item) => item.tabIndex)).toEqual([0, -1, -1]);
    expect(option('one')).toHaveAttribute('aria-current', 'true');
  });

  it.each([
    { keys: '{ArrowDown}', from: 'one', to: 'two' },
    { keys: '{ArrowUp}', from: 'three', to: 'two' },
    { keys: '{End}', from: 'one', to: 'three' },
    { keys: '{Home}', from: 'three', to: 'one' },
    { keys: '{ArrowUp}', from: 'one', to: 'one' },
    { keys: '{ArrowDown}', from: 'three', to: 'three' },
  ])('moves focus to $to on $keys from $from', async ({ keys, from, to }) => {
    render(<Queue />);
    option(from).focus();

    await userEvent.keyboard(keys);

    expect(option(to)).toHaveFocus();
    expect(option(to)).toHaveAttribute('aria-current', 'true');
  });

  it('makes the option clicked the active one', async () => {
    render(<Queue />);

    await userEvent.click(option('three'));

    expect(option('three')).toHaveAttribute('aria-current', 'true');
    expect(option('one')).not.toHaveAttribute('aria-current');
  });

  it('marks the selected options, which is not the active one', () => {
    render(<Queue selected={['two', 'three']} />);

    expect(screen.getAllByRole('option').map((item) => item.getAttribute('aria-selected'))).toEqual(
      ['false', 'true', 'true']
    );
  });

  it('passes axe', async () => {
    render(<Queue />);

    expect(await axeViolations()).toEqual([]);
  });
});
