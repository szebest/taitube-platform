import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { PostComposer } from '../index';
import type { PostDraft } from '../types';
import { renderComposer } from './render-composer';

const POLL: Partial<PostDraft> = {
  kind: 'poll',
  question: 'Next topic?',
  options: ['Lighting', 'Audio'],
};
const QUIZ: Partial<PostDraft> = { ...POLL, kind: 'quiz', correctIndex: 1, explanation: '' };

function renderPoll(initial: Partial<PostDraft>, pollLocked = false) {
  return renderComposer(
    <>
      <PostComposer.Poll />
      <PostComposer.Quiz />
    </>,
    { initial, pollLocked }
  );
}

describe('apps/client/studio: PostComposerPoll', () => {
  it('writes the question and an option into the draft', async () => {
    const { user, draft } = renderPoll(POLL);

    await user.type(screen.getByRole('textbox', { name: /Question/ }), '?');
    await user.type(screen.getByRole('textbox', { name: 'Option 2' }), '!');

    expect(draft().question).toBe('Next topic??');
    expect(draft().options).toEqual(['Lighting', 'Audio!']);
  });

  it('adds options up to six, then no more', async () => {
    const { user, draft } = renderPoll({ ...POLL, options: ['a', 'b', 'c', 'd', 'e'] });

    await user.click(screen.getByRole('button', { name: 'Add option' }));

    expect(draft().options).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Add option' })).toBeDisabled();
  });

  it('keeps two options at least', () => {
    renderPoll(POLL);

    expect(screen.getByRole('button', { name: 'Remove option 1' })).toBeDisabled();
  });

  it('removes an option and moves the right answer with it', async () => {
    const { user, draft } = renderPoll({ ...QUIZ, options: ['a', 'b', 'c'], correctIndex: 2 });

    await user.click(screen.getByRole('button', { name: 'Remove option 1' }));

    expect(draft().options).toEqual(['b', 'c']);
    expect(draft().correctIndex).toBe(1);
  });

  it('marks the right answer of a quiz, and a poll has none to mark', async () => {
    const { user, draft } = renderPoll(QUIZ);

    await user.click(screen.getByRole('radio', { name: 'Option 1 is the right answer' }));

    expect(draft().correctIndex).toBe(0);
  });

  it('shows no right answer on a poll', () => {
    renderPoll(POLL);

    expect(screen.queryAllByRole('radio')).toEqual([]);
  });

  it('writes the explanation of a quiz and counts it against 300', async () => {
    const { user, draft } = renderPoll(QUIZ);

    await user.type(screen.getByRole('textbox', { name: /Explanation/ }), 'Because');

    expect(draft().explanation).toBe('Because');
    expect(screen.getByText('7 of 300')).toBeInTheDocument();
  });

  it('locks the question and options once someone has voted, and says so', () => {
    renderPoll(POLL, true);

    expect(screen.getByRole('status')).toHaveTextContent('Voting has started');
    expect(screen.getByRole('textbox', { name: /Question/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Option 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add option' })).toBeDisabled();
  });

  it('clears a close time', async () => {
    const { user, draft } = renderPoll({ ...POLL, closesAt: '2026-12-24T18:30' });

    await user.click(screen.getByRole('button', { name: 'Keep it open' }));

    expect(draft().closesAt).toBe('');
  });

  it('passes axe', async () => {
    renderPoll(QUIZ);

    expect(await axeViolations()).toEqual([]);
  });
});
