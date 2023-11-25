import styles from './loading-spinner.module.scss';


export function LoadingSpinner() {
  return (
    <span className={styles["spinner-container"]}>
      <div className={styles["loading-spinner"]}>
      </div>
    </span>
  );
}

export default LoadingSpinner;