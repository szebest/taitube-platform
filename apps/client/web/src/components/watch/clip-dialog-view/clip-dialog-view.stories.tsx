import type { Meta, StoryObj } from '@storybook/react-vite';
import { createToaster, ResponsiveModal, ToastProvider } from '@vp/ui';
import { useState } from 'react';
import { ClipDialogView } from '.';
import { ClipEditor, type ClipEditorSprite, type ClipEditorValue } from '../clip-editor';
import { ClipDialogViewRoot } from './clip-dialog-view';

const SHEET = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="180" viewBox="0 0 10 1"><defs><linearGradient id="g"><stop offset="0" stop-color="#8a3d17"/><stop offset="1" stop-color="#17508a"/></linearGradient></defs><rect width="10" height="1" fill="url(#g)"/></svg>'
)}`;

const SPRITE: ClipEditorSprite = {
  url: SHEET,
  intervalSec: 10,
  columns: 10,
  tileWidth: 160,
  tileHeight: 90,
};

const clock = (ms: number) =>
  `${Math.floor(ms / 60_000)}:${String((ms / 1000) % 60).padStart(2, '0')}`;

const TITLE_ERROR = 'Give the clip a title of 1 to 100 characters';
const RANGE_ERROR = 'A clip runs from 5 to 60 seconds and stays inside the video';

interface DialogState {
  initial?: ClipEditorValue;
  title?: string;
  titleError?: string;
  rangeError?: string;
  saving?: boolean;
  failed?: boolean;
}

function Dialog({
  initial = { startMs: 20_000, endMs: 40_000 },
  title: initialTitle = 'Launch day',
  titleError,
  rangeError,
  saving,
  failed,
}: DialogState) {
  const [range, setRange] = useState(initial);
  const [title, setTitle] = useState(initialTitle);
  const [toaster] = useState(() => {
    const created = createToaster();
    if (failed) {
      created.show({ tone: 'danger', title: 'Your clip could not be saved' });
    }
    return created;
  });

  return (
    <ToastProvider toaster={toaster}>
      <ClipDialogView.Root
        defaultOpen
        title="Clip this video"
        description="Pick a stretch of 5 to 60 seconds. Anyone with the link plays just that part."
      >
        <ClipDialogView.Form>
          <ResponsiveModal.Body>
            <ClipEditor.Root durationMs={120_000} range={range} onRangeChange={setRange}>
              <ClipEditor.Preview className="aspect-auto h-20" />
              <ClipEditor.Range
                aria-label="Clip range"
                sprite={SPRITE}
                startLabel="Clip start"
                endLabel="Clip end"
                summary={
                  rangeError ??
                  `${clock(range.startMs)} to ${clock(range.endMs)}, ${clock(range.endMs - range.startMs)} long`
                }
              />
            </ClipEditor.Root>
            <ClipDialogView.TitleField
              label="Title"
              name="title"
              value={title}
              onValueChange={setTitle}
              error={titleError}
            />
          </ResponsiveModal.Body>
          <ClipDialogView.Footer
            saveLabel="Save clip"
            saving={saving}
            canSave={titleError === undefined && rangeError === undefined}
          />
        </ClipDialogView.Form>
      </ClipDialogView.Root>
    </ToastProvider>
  );
}

const meta = {
  title: 'Web/ClipDialog',
  tags: ['text'],
  component: ClipDialogViewRoot,
} satisfies Meta<typeof ClipDialogViewRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Dialog />,
};

export const TitleInvalid: Story = {
  render: () => <Dialog title="" titleError={TITLE_ERROR} />,
};

export const RangeInvalid: Story = {
  render: () => <Dialog initial={{ startMs: 20_000, endMs: 22_000 }} rangeError={RANGE_ERROR} />,
};

export const Saving: Story = {
  render: () => <Dialog saving />,
};

export const SaveFailed: Story = {
  render: () => <Dialog failed />,
};
