import styles from './loading-spinner.module.scss';


export function LoadingSpinner() {
  return (
    <div className={styles["spinner-container"]}>
      <div className={styles["loading-spinner"]}>
      </div>
    </div>
  );
}

export default LoadingSpinner;