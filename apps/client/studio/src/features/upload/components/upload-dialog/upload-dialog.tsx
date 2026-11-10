import { VIDEO_VISIBILITIES } from '@vp/api-contracts';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { Button, ResponsiveModal } from '@vp/ui';
import {
  VIDEO_FILE_ACCEPT,
  validateVideoFile,
  videoTitleValidators,
} from '#app/utils/video-field-validators';
import { type UploadStart, useUploadDock } from '../upload-dock/upload-dock';

const EMPTY_UPLOAD = {
  file: [] as File[],
  title: '',
  visibility: 'private' as UploadStart['visibility'],
};

function UploadForm() {
  const { start, sending, setDialogOpen } = useUploadDock('Dialog');
  const { tOr } = useT();
  const form = useAppForm({
    defaultValues: EMPTY_UPLOAD,
    onSubmit: ({
      value: {
        file: [file],
        title,
        visibility,
      },
    }) => {
      if (!file) return;

      start({ file, title, visibility });
      setDialogOpen(false);
    },
  });

  return (
    <form
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <ResponsiveModal.Body className="flex flex-col gap-stack">
        <form.AppField name="file" validators={{ onChange: validateVideoFile }}>
          {(field) => (
            <field.FileField
              accept={VIDEO_FILE_ACCEPT}
              placeholderText={tOr('studio.uploadDrop', {}, '')}
            />
          )}
        </form.AppField>
        <form.AppField name="title" validators={videoTitleValidators}>
          {(field) => <field.TextField label={tOr('studio.uploadFieldTitle', {}, '')} />}
        </form.AppField>
        <form.AppField name="visibility">
          {(field) => (
            <field.SelectField
              label={tOr('studio.uploadFieldVisibility', {}, '')}
              options={VIDEO_VISIBILITIES}
              labelOf={(visibility) => tOr('videos.visibility', { visibility }, '')}
            />
          )}
        </form.AppField>
        {sending && <p role="status">{tOr('studio.uploadBusy', {}, '')}</p>}
      </ResponsiveModal.Body>
      <ResponsiveModal.Footer>
        <ResponsiveModal.Close asChild>
          <Button type="button" variant="ghost">
            {tOr('studio.uploadCancel', {}, '')}
          </Button>
        </ResponsiveModal.Close>
        <form.Subscribe selector={(state) => state.canSubmit && state.values.file.length > 0}>
          {(canUpload) => (
            <Button type="submit" variant="solid" tone="accent" disabled={!canUpload || sending}>
              {tOr('studio.uploadSubmit', {}, '')}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveModal.Footer>
    </form>
  );
}

/** The dialog every studio page can open: pick or drop a file, name it, and hand it to the dock. */
export function UploadDialog() {
  const { dialogOpen, setDialogOpen } = useUploadDock('Dialog');
  const { tOr } = useT();

  return (
    <ResponsiveModal.Root open={dialogOpen} onOpenChange={setDialogOpen}>
      <ResponsiveModal.Content>
        <ResponsiveModal.Header>
          <ResponsiveModal.Title>{tOr('studio.uploadTitle', {}, '')}</ResponsiveModal.Title>
          <ResponsiveModal.Description>
            {tOr('studio.uploadDescription', {}, '')}
          </ResponsiveModal.Description>
        </ResponsiveModal.Header>
        <UploadForm />
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}
