import { ProgressBar } from 'react-bootstrap';

import styles from './upload-progress.module.scss';

import { uploadProgress } from '@vp/intl';
import { Format } from '@vp/intl-react';

import { uploadsApi } from '../../api';

export function UploadProgress() {
  const { data: loaded } = uploadsApi.useUploadProgressQuery();

  return (
    <div className={styles.progress}>
      <p>Progress: <Format value={uploadProgress(loaded ?? 0)} /></p>
      <ProgressBar now={loaded} />
    </div>
  )
}
