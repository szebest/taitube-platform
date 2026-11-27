import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { PostComposer } from '../index';
import { renderComposer } from './render-composer';

const renderText = (text = '') => renderComposer(<PostComposer.Text />, { initial: { text } });

describe('apps/client/studio: PostComposerText', () => {
  it('writes what is typed into the draft and counts it against 2,000', async () => {
    const { user, draft } = renderText();

    await user.type(screen.getByRole('textbox', { name: /What do you want to say/ }), 'Hello');

    expect(draft().text).toBe('Hello');
    expect(screen.getByText('5 of 2,000')).toBeInTheDocument();
  });

  it('marks the count past the limit', () => {
    renderText('x'.repeat(2001));

    expect(screen.getByText('2,001 of 2,000')).toHaveClass('text-danger-ink');
  });

  it('passes axe', async () => {
    renderText('Hello');

    expect(await axeViolations()).toEqual([]);
  });
});
