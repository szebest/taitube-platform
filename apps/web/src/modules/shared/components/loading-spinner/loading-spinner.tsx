import styles from './loading-spinner.module.scss';

export function LoadingSpinner() {
  return (
    <span className={styles["spinner-container"]} role="status" aria-label="Loading">
      <div className={styles["loading-spinner"]} />
    </span>
  );
}
