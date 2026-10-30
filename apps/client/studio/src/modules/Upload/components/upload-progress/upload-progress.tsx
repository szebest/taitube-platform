import { uploadProgress } from '@vp/intl';
import { Format } from '@vp/intl-react';
import { ProgressBar } from 'react-bootstrap';
import styles from './upload-progress.module.css';

export type UploadProgressProps = {
  percent: number;
};

export function UploadProgress({ percent }: UploadProgressProps) {
  return (
    <div className={styles.progress}>
      <p>
        Progress: <Format value={uploadProgress(percent)} />
      </p>
      <ProgressBar now={percent} />
    </div>
  );
}
