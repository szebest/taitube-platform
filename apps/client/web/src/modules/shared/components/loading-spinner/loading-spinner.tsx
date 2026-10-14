import styles from './loading-spinner.module.scss';

export function LoadingSpinner() {
  return (
    <output className={styles["spinner-container"]} aria-label="Loading">
      <div className={styles["loading-spinner"]} />
    </output>
  );
}
