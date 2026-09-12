import { ProgressBar } from 'react-bootstrap';

import styles from './upload-progress.module.scss';

import { useUploadProgressQuery } from '../../api/uploadApiSlice';

export function UploadProgress() {
  const { data: loaded } = useUploadProgressQuery();

  return (
    <div className={styles.progress}>
      <p>Progress: {Math.round(loaded ?? 0)}%</p>
      <ProgressBar now={loaded} />
    </div>
  )
}

export default UploadProgress;
