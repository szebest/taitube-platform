import { ThemeMenu } from '@vp/ui';
import { memo } from 'react';

import styles from './header.module.scss';

import { Logo, Login } from '..';

export const Header = memo(() => {
  return (
    <header className={styles.header}>
      <div className={styles.hide}>
        <Logo hideLogoPart />
      </div>
      <div className={`${styles.header__right} ${styles.hide}`}>
        <div>
          <ThemeMenu />
        </div>
        <Login />
      </div>
    </header>
  );
});
