import { Form } from 'react-bootstrap';

import styles from '../video-form.module.scss';

import { type UpdateVideoMetadata, VIDEO_VISIBILITIES } from '@vp/api-contracts';

import {
  validateVideoDescription,
  validateVideoTitle,
} from '#app/features/videos/forms/video-field-validators';
import { useAppForm } from '#app/integrations/form/use-app-form';

export type EditVideoFormValues = Required<
  Pick<UpdateVideoMetadata, 'title' | 'description' | 'visibility'>
>;

export type EditVideoFormProps = {
  isError: boolean;
  isLoading: boolean;
  defaultValues: EditVideoFormValues;
  submit: (form: EditVideoFormValues) => void;
};

export const EditVideoForm = ({
  isError,
  isLoading,
  defaultValues,
  submit,
}: EditVideoFormProps) => {
  const form = useAppForm({ defaultValues, onSubmit: ({ value }) => submit(value) });

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className={styles.form}
    >
      <form.AppField
        name="title"
        validators={{ onMount: validateVideoTitle, onChange: validateVideoTitle }}
      >
        {(field) => <field.TextField label="Video title" />}
      </form.AppField>

      <form.AppField
        name="description"
        validators={{ onMount: validateVideoDescription, onChange: validateVideoDescription }}
      >
        {(field) => (
          <field.TextField label="Video description" multiline className={styles.form__textarea} />
        )}
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

      {isError ? (
        <button type="submit" className="btn btn-danger btn-white-text" aria-label="retry">
          Retry
        </button>
      ) : (
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="btn btn-primary"
              aria-label="upload"
            >
              Edit
            </button>
          )}
        </form.Subscribe>
      )}
    </Form>
  );
};
