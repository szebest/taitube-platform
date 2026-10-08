import { Link } from '@tanstack/react-router';
import { Form } from 'react-bootstrap';

import styles from '../video-form.module.scss';

import { type StartUpload, VIDEO_VISIBILITIES } from '@vp/api-contracts';

import type { CompletedUpload } from '#app/features/upload/api/upload-video';
import {
  VIDEO_FILE_ACCEPT,
  validateVideoFile,
  validateVideoTitle,
} from '#app/features/videos/forms/video-field-validators';
import { useAppForm } from '#app/integrations/form/use-app-form';
import { UploadProgress } from '../..';

export type UploadFormValues = Required<Pick<StartUpload, 'title' | 'visibility'>> & {
  file: File[];
};

const EMPTY_UPLOAD: UploadFormValues = { file: [], title: '', visibility: 'private' };

export type VideoFormProps = {
  isError: boolean;
  isSuccess: boolean;
  progress: number;
  reset: VoidFunction;
  data?: CompletedUpload;
  submit: (form: UploadFormValues) => void;
};

export const VideoForm = ({
  isError,
  isSuccess,
  progress,
  reset: resetMutation,
  data,
  submit,
}: VideoFormProps) => {
  const form = useAppForm({ defaultValues: EMPTY_UPLOAD, onSubmit: ({ value }) => submit(value) });

  const clearForm = () => {
    form.reset();
    resetMutation();
  };

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className={styles.form}
    >
      <form.AppField name="file" validators={{ onChange: validateVideoFile }}>
        {(field) => (
          <field.FileField
            accept={VIDEO_FILE_ACCEPT}
            placeholderText="Drag 'n' drop, or click to select video file"
          />
        )}
      </form.AppField>

      <form.AppField
        name="title"
        validators={{ onMount: validateVideoTitle, onChange: validateVideoTitle }}
      >
        {(field) => <field.TextField label="Video title" />}
      </form.AppField>

      <form.AppField name="visibility">
        {(field) => (
          <field.SelectField
            label="Visibility"
            ariaLabel="Video visibility"
            options={VIDEO_VISIBILITIES}
          />
        )}
      </form.AppField>

      <form.Subscribe
        selector={(state) => ({
          isSubmitted: state.isSubmitted,
          canUpload: state.canSubmit && state.values.file.length > 0,
        })}
      >
        {({ isSubmitted, canUpload }) => (
          <>
            {isSuccess ? (
              <button
                type="button"
                onClick={clearForm}
                className="btn btn-primary"
                aria-label="submit another video"
              >
                Submit another video
              </button>
            ) : isError ? (
              <button type="submit" className="btn btn-danger btn-white-text" aria-label="retry">
                Retry
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canUpload || isSubmitted}
                className="btn btn-primary"
                aria-label="upload"
              >
                Upload
              </button>
            )}

            {isSuccess && data && (
              <Link
                to="/watch/$videoId"
                params={{ videoId: data.videoId }}
                className="btn btn-primary"
              >
                Go to the uploaded video page
              </Link>
            )}

            {isSubmitted && !isError && <UploadProgress percent={progress} />}
          </>
        )}
      </form.Subscribe>
    </Form>
  );
};
