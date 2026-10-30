import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { useState } from 'react';

import { ChoiceCards } from '..';

function Cards({ onChange = () => undefined }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('soft');

  return (
    <ChoiceCards.Root
      aria-label="Corners"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    >
      {['sharp', 'soft'].map((option) => (
        <ChoiceCards.Option key={option} value={option}>
          <ChoiceCards.Preview>preview of {option}</ChoiceCards.Preview>
          <ChoiceCards.Label>{option}</ChoiceCards.Label>
        </ChoiceCards.Option>
      ))}
    </ChoiceCards.Root>
  );
}

const renderCards = (onChange?: (value: string) => void) => render(<Cards onChange={onChange} />);

describe('ChoiceCards', () => {
  it('is a radio group of its options, named by their labels and not by their previews', () => {
    renderCards();

    expect(screen.getByRole('radiogroup', { name: 'Corners' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'soft' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'sharp' })).not.toBeChecked();
  });

  it('chooses an option by click and by arrow key', async () => {
    const onChange = vi.fn();
    renderCards(onChange);

    await userEvent.click(screen.getByText('sharp'));
    expect(onChange).toHaveBeenLastCalledWith('sharp');

    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('soft');
  });

  it('has no accessibility violations', async () => {
    renderCards();

    expect(await axeViolations()).toEqual([]);
  });

  it('refuses a part outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ChoiceCards.Option value="x">x</ChoiceCards.Option>)).toThrow(
      'ChoiceCards.Option must be inside ChoiceCards.Root'
    );
  });
});
