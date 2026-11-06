import { screen } from '@testing-library/react';
import { VIDEO_ID, captionTrack } from '@vp/web-testing';
import { serveCaptions } from '#app/features/captions/__tests__/captions-api.fixture';
import { renderCaptions } from '#app/features/captions/__tests__/render-captions';
import { CueEditorDialog } from '../cue-editor-dialog';

const READY_EN = captionTrack({ version: 3 });

function renderEditor() {
  const served = serveCaptions({ tracks: [READY_EN] });
  const onOpenChange = vi.fn();
  const rendered = renderCaptions(
    <CueEditorDialog videoId={VIDEO_ID} track={READY_EN} open onOpenChange={onOpenChange} />,
    served.handlers
  );
  return { ...rendered, ...served, onOpenChange };
}

const save = () => screen.getByRole('button', { name: 'Save cues' });

describe('apps/client/studio: CueEditorDialog', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  });

  it('has nothing to save until a cue differs from what was generated', async () => {
    const { user } = renderEditor();
    const cue = await screen.findByRole('textbox', { name: 'Cue 1' });
    expect(save()).toBeDisabled();

    await user.type(cue, '!');
    expect(save()).toBeEnabled();
    await user.type(cue, '{Backspace}');

    expect(save()).toBeDisabled();
  });

  it('sends only the cues that changed, against the version of the track, and closes', async () => {
    const { user, writes, onOpenChange } = renderEditor();

    const cue = await screen.findByRole('textbox', { name: 'Cue 2' });
    await user.clear(cue);
    await user.type(cue, 'Today we bake rye');
    await user.click(save());

    expect(await screen.findByText('Cues saved')).toBeInTheDocument();
    expect(writes.cues).toEqual([{ version: 3, cues: [{ index: 1, text: 'Today we bake rye' }] }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('offers a stale edit the choice, and overwriting resends it on the version now held', async () => {
    const { user, writes, state } = renderEditor();

    const cue = await screen.findByRole('textbox', { name: 'Cue 1' });
    state.tracks = [{ ...READY_EN, version: 4 }];
    await user.type(cue, '!');
    await user.click(save());
    await user.click(await screen.findByRole('button', { name: 'Overwrite' }));

    expect(await screen.findByText('Cues saved')).toBeInTheDocument();
    expect(writes.cues).toEqual([
      { version: 3, cues: [{ index: 0, text: 'Hello and welcome!' }] },
      { version: 4, cues: [{ index: 0, text: 'Hello and welcome!' }] },
    ]);
  });

  it('drops the edit on reload, so the creator starts from the cues as they are now', async () => {
    const { user, writes, state } = renderEditor();

    const cue = await screen.findByRole('textbox', { name: 'Cue 1' });
    state.tracks = [{ ...READY_EN, version: 4 }];
    await user.type(cue, '!');
    await user.click(save());
    await user.click(await screen.findByRole('button', { name: 'Reload' }));

    expect(await screen.findByRole('textbox', { name: 'Cue 1' })).toHaveValue('Hello and welcome');
    expect(writes.cues).toHaveLength(1);
  });
});
