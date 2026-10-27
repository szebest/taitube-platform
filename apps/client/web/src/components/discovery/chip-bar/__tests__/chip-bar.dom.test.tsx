import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { ChipBar, ChipBarSkeleton, type ChipBarValue } from '..';

const CATEGORIES = ['all', 'film', 'music', 'cooking'];

const renderBar = (value: ChipBarValue, onValueChange = vi.fn()) => {
  render(
    <AppProviders>
      <ChipBar.Root aria-label="Categories" value={value} onValueChange={onValueChange}>
        {CATEGORIES.map((category) => (
          <ChipBar.Item
            key={category}
            value={category}
            disabled={category === 'cooking'}
            count={category === 'film' ? '12' : undefined}
          >
            {category}
          </ChipBar.Item>
        ))}
      </ChipBar.Root>
    </AppProviders>
  );
  return { onValueChange, user: userEvent.setup() };
};

describe('apps/client/web: ChipBar', () => {
  it('is a radio group with one checked chip when the value is a string', () => {
    renderBar('film');

    expect(screen.getByRole('radiogroup', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'film 12' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'all' })).toHaveAttribute('aria-checked', 'false');
  });

  it('is a group of pressed toggles when the value is an array', () => {
    renderBar(['all', 'music']);

    expect(screen.getByRole('group', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'music' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'film 12' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it.each([
    { name: 'selects another chip', value: 'all', chip: 'music', expected: 'music' },
    { name: 'adds a chip to the set', value: ['all'], chip: 'music', expected: ['all', 'music'] },
    {
      name: 'takes a chip out of the set',
      value: ['all', 'music'],
      chip: 'all',
      expected: ['music'],
    },
  ])('$name on click', async ({ value, chip, expected }) => {
    const { onValueChange, user } = renderBar(value);

    await user.click(screen.getByText(chip));

    expect(onValueChange).toHaveBeenCalledWith(expected);
  });

  it.each([
    { name: 'the selected chip', value: 'all', chip: 'all' },
    { name: 'a disabled chip', value: 'all', chip: 'cooking' },
  ])('changes nothing on a click on $name', async ({ value, chip }) => {
    const { onValueChange, user } = renderBar(value);

    await user.click(screen.getByText(chip));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps one tab stop, on the selected chip', () => {
    renderBar('music');

    expect(screen.getByRole('radio', { name: 'music' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'all' })).toHaveAttribute('tabindex', '-1');
  });

  it.each([
    { key: '{ArrowRight}', focused: 'music' },
    { key: '{ArrowLeft}', focused: 'all' },
    { key: '{End}', focused: 'music' },
  ])(
    'moves focus and selection with $key in single mode, past disabled chips',
    async ({ key, focused }) => {
      const { onValueChange, user } = renderBar('film');
      screen.getByRole('radio', { name: 'film 12' }).focus();

      await user.keyboard(key);

      expect(screen.getByRole('radio', { name: focused })).toHaveFocus();
      expect(onValueChange).toHaveBeenCalledWith(focused);
    }
  );

  it('moves focus only with the arrows in multiple mode, and Space toggles', async () => {
    const { onValueChange, user } = renderBar(['all']);
    screen.getByRole('button', { name: 'all' }).focus();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('button', { name: 'film 12' })).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();

    await user.keyboard(' ');

    expect(onValueChange).toHaveBeenCalledWith(['all', 'film']);
  });

  it('marks the selected link as current when the chips are links', () => {
    render(
      <AppProviders>
        <ChipBar.Root aria-label="Categories" value="film" onValueChange={vi.fn()}>
          <ChipBar.Item value="all" asChild>
            <a href="/?category=all">All</a>
          </ChipBar.Item>
          <ChipBar.Item value="film" asChild>
            <a href="/?category=film">Film</a>
          </ChipBar.Item>
        </ChipBar.Root>
      </AppProviders>
    );

    expect(screen.getByRole('radio', { name: 'Film' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('radio', { name: 'All' })).not.toHaveAttribute('aria-current');
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderBar('film');
    render(<ChipBarSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
