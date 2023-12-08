import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from 'react-bootstrap';

import styles from './upload-page.module.scss';

import { useUploadMutation } from '../../api/uploadApiSlice';

import { DropzoneField, UploadProgress } from '../../components';

import { UploadFormModel } from '../../models';

import { getCategories } from 'src/modules/shared/helpers';

export function UploadPage() {
  const acceptFileTypes = useMemo(() => ({
    'video/mp4': ['.mp4']
  }), []);

  const categories = useMemo(() => {
    return getCategories();
  }, []);

  const [upload, { isError, isSuccess, reset: resetMutation }] = useUploadMutation();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitted, isValid }
  } = useForm();

  const submit = (form: UploadFormModel) => {
    upload(form);
  }

  const clearForm = () => {
    reset();
    resetMutation();
  }

  return (
    <div>
      <Form onSubmit={handleSubmit((form) => submit(form as UploadFormModel))} className={styles.form}>
        <DropzoneField
          name='file' 
          control={control} 
          validation={{ required: true }}
          accept={acceptFileTypes}
          multiple={false} 
          placeholderText="Drag 'n' drop, or click to select video file" />

        <Form.Group controlId="title">
          <Form.Label>Video title</Form.Label>
          <Form.Control type="text" {...register('title', { required: true })} />
        </Form.Group>

        <Form.Group controlId="description">
          <Form.Label>Video description</Form.Label>
          <Form.Control as="textarea" type="text" {...register('description', { required: true })} className={styles.form__textarea} />
        </Form.Group>

        <Form.Group controlId="category">
          <Form.Label>Category</Form.Label>
          <Form.Select defaultValue={-1} aria-label="Video category" {...register('category', { required: true })}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.value}</option>
            ))}
          </Form.Select>
        </Form.Group>

        {
          isSuccess ?
            <button type="button" onClick={clearForm} className='btn btn-primary' aria-label="submit another video">
              Submit another video
            </button> :
            (
              isError ?
                <button type="submit" className='btn btn-danger' aria-label="retry">
                  Retry
                </button> :
                <button type="submit" disabled={!isValid || isSubmitted} className='btn btn-primary' aria-label="upload">
                  Upload
                </button>
            )
        }

        {isSubmitted && !isError && 
          <UploadProgress />
        }
      </Form>
    </div>
  )
}

export default UploadPage;
