import { ThemeMenu } from '@vp/ui';
import { memo } from 'react';

import styles from './header.module.scss';

import { useAuth } from '@vp/queries';

import { Logo, Login } from '..';

export const Header = memo(() => {
  const { isLoading } = useAuth();

  if (isLoading) return <div className={styles.header} />;

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
