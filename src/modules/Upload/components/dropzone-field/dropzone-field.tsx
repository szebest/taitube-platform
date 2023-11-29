import Dropzone, { DropzoneProps } from "react-dropzone";
import { Control, Controller, FieldValues, RegisterOptions } from "react-hook-form";

import styles from './dropzone.field.module.scss';

export type DropzoneFieldProps = {
  name: string,
  control: Control<FieldValues> | undefined,
  placeholderText?: string,
  validation?: Omit<RegisterOptions<FieldValues, string>, "disabled" | "setValueAs" | "valueAsNumber" | "valueAsDate">
} & DropzoneProps;

const DropzoneField = ({
  name,
  control,
  validation,
  placeholderText = "Drag 'n' drop some files here, or click to select files",
  ...rest
}: DropzoneFieldProps) => {
  return (
    <Controller
      rules={validation}
      render={({ field: { onChange, value } }) => (
        <Dropzone
          onDrop={e => onChange(e)}
          {...rest}
        >
          {({getRootProps, getInputProps}) => (
            <div {...getRootProps()} className={styles.dropzone}>
              <input {...getInputProps()} />
              {
                value.length === 0 ?
                  <p>{placeholderText}</p> :
                  <>
                    <p>Selected file{value.length > 1 ? 's' : ''}:</p>
                    {value.map((v: File, i: number) => 
                      <p key={i}>{v.name}</p>
                    )}
                  </>
              }
            </div>
          )}
        </Dropzone>
      )}
      name={name}
      control={control}
      defaultValue={[]}
    />
  )
}

export default DropzoneField;