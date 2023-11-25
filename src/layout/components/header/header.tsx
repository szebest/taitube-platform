import Login from 'src/modules/shared/components/login/login';
import styles from './header.module.scss';
import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.header__logo}>
        <Link to='/' className={styles.header__logo}>
          <h6>YOUTUBE</h6>
        </Link>
      </div>

      <div className={styles.header__login}>
        <Login />
      </div>
    </header>
  );
}

export default Header;
