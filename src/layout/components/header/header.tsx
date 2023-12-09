import { memo } from 'react';

import styles from './header.module.scss';

import { Logo, Login } from '..';

export const Header = memo(() => {
  return (
    <header className={styles.header}>
      <div>
        <Logo />
      </div>

      <div className={styles.header__login}>
        <Login />
      </div>
    </header>
  );
});

export default Header;
