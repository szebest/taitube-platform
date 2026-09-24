import { ProgressBar } from 'react-bootstrap';

import styles from './upload-progress.module.scss';

import { uploadsApi } from '../../api';

export function UploadProgress() {
  const { data: loaded } = uploadsApi.useUploadProgressQuery();

  return (
    <div className={styles.progress}>
      <p>Progress: {Math.round(loaded ?? 0)}%</p>
      <ProgressBar now={loaded} />
    </div>
  )
}
