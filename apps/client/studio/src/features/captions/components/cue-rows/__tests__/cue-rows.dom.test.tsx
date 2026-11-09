import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { transcript } from '@vp/web-testing';
import { AppProviders } from '#app/__tests__/providers';
import { CueRows } from '../cue-rows';

function renderRows(drafts: Record<number, string> = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<CueRows cues={transcript().cues} drafts={drafts} onChange={onChange} />, {
    wrapper: AppProviders,
  });
  return { user, onChange };
}

describe('apps/client/studio: CueRows', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  });

  it('shows each cue as it was generated, with its start time beside its text', () => {
    renderRows();

    expect(screen.getByRole('textbox', { name: 'Cue 1' })).toHaveValue('Hello and welcome');
    expect(screen.getByRole('textbox', { name: 'Cue 3' })).toHaveValue('First the flour');
    expect(screen.getByText('00:05')).toBeInTheDocument();
  });

  it('shows a draft over the generated text', () => {
    renderRows({ 1: 'Today we bake rye' });

    expect(screen.getByRole('textbox', { name: 'Cue 2' })).toHaveValue('Today we bake rye');
  });

  it('reports the index of the cue being typed in', async () => {
    const { user, onChange } = renderRows();

    await user.type(screen.getByRole('textbox', { name: 'Cue 3' }), '!');

    expect(onChange).toHaveBeenLastCalledWith(2, 'First the flour!');
  });
});
