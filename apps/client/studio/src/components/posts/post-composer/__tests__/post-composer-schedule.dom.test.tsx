import { axeViolations } from '@kit/web-testing/dom';
import { fireEvent, screen } from '@testing-library/react';
import { PostComposer } from '../index';
import type { PostDraft } from '../types';
import { renderComposer } from './render-composer';

const renderSchedule = (initial: Partial<PostDraft> = {}, published = false) =>
  renderComposer(<PostComposer.Schedule published={published} />, { initial });

describe('apps/client/studio: PostComposerSchedule', () => {
  it.each([
    { choice: 'Save as draft', timing: 'draft' },
    { choice: 'Schedule', timing: 'schedule' },
    { choice: 'Publish now', timing: 'now' },
  ])('chooses $timing from "$choice"', async ({ choice, timing }) => {
    const { user, draft } = renderSchedule({ timing: timing === 'now' ? 'draft' : 'now' });

    await user.click(screen.getByRole('radio', { name: choice }));

    expect(draft().timing).toBe(timing);
  });

  it('asks for a time only when scheduling, and writes it into the draft', () => {
    const { draft } = renderSchedule({ timing: 'schedule' });

    fireEvent.change(screen.getByLabelText(/Publish at/), { target: { value: '2026-12-24' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '18:30' } });

    expect(draft().publishAt).toBe('2026-12-24T18:30');
  });

  it('shows no time box for a post going out now', () => {
    renderSchedule({ timing: 'now' });

    expect(screen.queryByLabelText('Time')).toBeNull();
  });

  it('shows nothing for a post already published', () => {
    renderSchedule({}, true);

    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('passes axe', async () => {
    renderSchedule({ timing: 'schedule', publishAt: '2026-12-24T18:30' });

    expect(await axeViolations()).toEqual([]);
  });
});
