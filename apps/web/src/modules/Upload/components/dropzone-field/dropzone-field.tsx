import Dropzone, { type DropzoneProps } from "react-dropzone";
import {
	type Control,
	Controller,
	type FieldPath,
	type FieldValues,
	type RegisterOptions,
} from "react-hook-form";

import styles from './dropzone-field.module.scss';

export type DropzoneFieldProps<T extends FieldValues> = {
	name: FieldPath<T>,
	control: Control<T> | undefined,
	placeholderText?: string,
	validation?: Omit<RegisterOptions<T, FieldPath<T>>, "disabled" | "setValueAs" | "valueAsNumber" | "valueAsDate">
} & DropzoneProps;

export const DropzoneField = <T extends FieldValues>({
	name,
	control,
	validation,
	placeholderText = "Drag 'n' drop some files here, or click to select files",
	...rest
}: DropzoneFieldProps<T>) => {
	return (
		<Controller
			rules={validation}
			render={({ field: { onChange, value } }) => (
				<Dropzone
					onDrop={e => onChange(e)}
					{...rest}
				>
					{({ getRootProps, getInputProps }) => (
						<div {...getRootProps()} className={styles.dropzone}>
							<input {...getInputProps()} />
							{
								value.length === 0 ?
									<p>{placeholderText}</p> :
									<>
										<p>Selected file{value.length > 1 ? 's' : ''}:</p>
										{value.map((v: File) =>
											<p key={v.name}>{v.name}</p>
										)}
									</>
							}
						</div>
					)}
				</Dropzone>
			)}
			name={name}
			control={control}
			defaultValue={[] as never}
		/>
	)
}
