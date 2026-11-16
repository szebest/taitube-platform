import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { useState } from 'react';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Field } from '../../field';
import { TagInput } from '../tag-input';

function Harness({ initial = [], max }: { initial?: string[]; max?: number }) {
  const [tags, setTags] = useState(initial);

  return (
    <WithUiCopy>
      <Field.Root>
        <Field.Label>Words</Field.Label>
        <TagInput value={tags} onValueChange={setTags} max={max} />
        <span data-testid="tags">{tags.join('|')}</span>
      </Field.Root>
    </WithUiCopy>
  );
}

const field = () => screen.getByRole('textbox', { name: 'Words' });
const tags = () => screen.getByTestId('tags').textContent;

describe('@vp/ui: TagInput', () => {
  it.each([
    { typed: 'spoiler{Enter}', expected: 'spoiler' },
    { typed: 'spoiler,', expected: 'spoiler' },
    { typed: '  spoiler  {Enter}', expected: 'spoiler' },
    { typed: 'one,two;three{Enter}', expected: 'one|two|three' },
    { typed: '{Enter}', expected: '' },
    { typed: 'spoiler', expected: '' },
  ])('turns "$typed" into $expected', async ({ typed, expected }) => {
    render(<Harness />);

    await userEvent.type(field(), typed);

    expect(tags()).toBe(expected);
  });

  it('takes a tag when the field is left', async () => {
    render(<Harness />);

    await userEvent.type(field(), 'spoiler');
    await userEvent.tab();

    expect(tags()).toBe('spoiler');
  });

  it.each([
    { pasted: 'one, two\nthree', expected: 'one|two|three' },
    { pasted: 'one,one,ONE', expected: 'one' },
    { pasted: ' ,, one ,', expected: 'one' },
  ])('splits a pasted list $pasted', async ({ pasted, expected }) => {
    render(<Harness />);
    await userEvent.click(field());

    await userEvent.paste(pasted);

    expect(tags()).toBe(expected);
    expect(field()).toHaveValue('');
  });

  it('pastes one word into the field as text', async () => {
    render(<Harness />);
    await userEvent.click(field());

    await userEvent.paste('spoiler');

    expect(field()).toHaveValue('spoiler');
    expect(tags()).toBe('');
  });

  it('drops a tag that is already in the list whatever its case, and says so', async () => {
    render(<Harness initial={['Spoiler']} />);

    await userEvent.type(field(), 'spoiler{Enter}');

    expect(tags()).toBe('Spoiler');
    expect(screen.getByRole('status')).toHaveTextContent('spoiler is already in the list');
  });

  it('stops saying so once something else is typed', async () => {
    render(<Harness initial={['spoiler']} />);

    await userEvent.type(field(), 'spoiler{Enter}x');

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('removes a tag from its chip', async () => {
    render(<Harness initial={['one', 'two']} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove one' }));

    expect(tags()).toBe('two');
  });

  it('removes the last tag on Backspace in an empty field, and none while typing', async () => {
    render(<Harness initial={['one', 'two']} />);

    await userEvent.type(field(), 'x{Backspace}');
    expect(tags()).toBe('one|two');
    await userEvent.type(field(), '{Backspace}');

    expect(tags()).toBe('one');
  });

  it('takes no more tags than its limit', async () => {
    render(<Harness initial={['one']} max={2} />);

    await userEvent.type(field(), 'two,three,four{Enter}');

    expect(tags()).toBe('one|two');
  });

  it('passes axe', async () => {
    render(<Harness initial={['one']} />);

    expect(await axeViolations()).toEqual([]);
  });
});
