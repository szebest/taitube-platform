import { fireEvent, render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { PickNoteField, type PickNoteFieldProps } from '../pick-note-field';

const renderNote = (props: Partial<PickNoteFieldProps> = {}) => {
  const onChange = vi.fn();
  render(<PickNoteField value="" onChange={onChange} refused={false} {...props} />, {
    wrapper: AppProviders,
  });
  return { onChange };
};

describe('apps/client/studio: PickNoteField', () => {
  it('counts the characters against the limit', () => {
    renderNote({ value: 'Start here' });

    expect(screen.getByText('10 of 280')).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toBeValid();
  });

  it('reports what is typed', () => {
    const { onChange } = renderNote();

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Hi' } });

    expect(onChange).toHaveBeenCalledWith('Hi');
  });

  it.each([
    { name: 'a note over the limit', props: { value: 'a'.repeat(281) } },
    { name: 'a note the API refused', props: { value: 'Hi', refused: true } },
  ])('flags $name', ({ props }) => {
    renderNote(props);

    expect(screen.getByLabelText('Note')).toBeInvalid();
    expect(screen.getByText('Keep the note to 280 characters.')).toBeInTheDocument();
  });
});
