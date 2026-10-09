import Dropzone, { type Accept } from 'react-dropzone';

import styles from './file-field.module.scss';

import { fieldError } from './field-error';
import { useFieldContext } from './form-context';

export type FileFieldProps = {
  accept?: Accept;
  multiple?: boolean;
  placeholderText?: string;
};

export function FileField({
  accept,
  multiple = false,
  placeholderText = "Drag 'n' drop some files here, or click to select files",
}: FileFieldProps) {
  const field = useFieldContext<File[]>();
  const files = field.state.value;
  const error = fieldError(field.state.meta);

  return (
    <Dropzone accept={accept} multiple={multiple} onDrop={(dropped) => field.handleChange(dropped)}>
      {({ getRootProps, getInputProps }) => (
        <div {...getRootProps()} className={styles.dropzone}>
          <input {...getInputProps()} name={field.name} />
          {files.length === 0 ? (
            <p>{placeholderText}</p>
          ) : (
            <>
              <p>Selected file{files.length > 1 ? 's' : ''}:</p>
              {files.map((file) => (
                <p key={file.name}>{file.name}</p>
              ))}
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </Dropzone>
  );
}
