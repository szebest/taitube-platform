import { type StartUpload, VIDEO_VISIBILITIES } from '@vp/api-contracts';
import { useAppForm } from '@vp/forms';
import { Form } from 'react-bootstrap';
import { WEB_URL } from '#app/config';
import type { CompletedUpload } from '#app/features/upload/api/upload-video';
import {
  VIDEO_FILE_ACCEPT,
  validateVideoFile,
  videoTitleValidators,
} from '#app/features/videos/forms/video-field-validators';
import { UploadProgress } from '#app/modules/Upload/components/upload-progress/upload-progress';
import styles from '../video-form.module.css';

export type UploadFormValues = Required<Pick<StartUpload, 'title' | 'visibility'>> & {
  file: File[];
};

const EMPTY_UPLOAD: UploadFormValues = { file: [], title: '', visibility: 'private' };

export type VideoFormProps = {
  isError: boolean;
  isSuccess: boolean;
  progress: number;
  reset: VoidFunction;
  cancel: VoidFunction;
  data?: CompletedUpload;
  submit: (form: UploadFormValues) => void;
};

export const VideoForm = ({
  isError,
  isSuccess,
  progress,
  reset: resetMutation,
  cancel,
  data,
  submit,
}: VideoFormProps) => {
  const form = useAppForm({ defaultValues: EMPTY_UPLOAD, onSubmit: ({ value }) => submit(value) });

  const clearForm = () => {
    form.reset();
    resetMutation();
  };

  const cancelUpload = () => {
    cancel();
    clearForm();
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

      <form.AppField name="title" validators={videoTitleValidators}>
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
              <a href={`${WEB_URL}/watch/${data.videoId}`} className="btn btn-primary">
                Go to the uploaded video page
              </a>
            )}

            {isSubmitted && !isError && !isSuccess && (
              <button
                type="button"
                onClick={cancelUpload}
                className="btn btn-outline-secondary"
                aria-label="cancel upload"
              >
                Cancel
              </button>
            )}

            {isSubmitted && !isError && <UploadProgress percent={progress} />}
          </>
        )}
      </form.Subscribe>
    </Form>
  );
};
