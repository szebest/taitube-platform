import { ProgressBar } from 'react-bootstrap';

import styles from './upload-progress.module.scss';

import { uploadProgress } from '@vp/intl';
import { Format } from '@vp/intl-react';

export type UploadProgressProps = {
  percent: number;
};

export function UploadProgress({ percent }: UploadProgressProps) {
  return (
    <div className={styles.progress}>
      <p>Progress: <Format value={uploadProgress(percent)} /></p>
      <ProgressBar now={percent} />
    </div>
  )
}
