import { memo } from 'react';
import { Button } from 'react-bootstrap';

import styles from './header.module.scss';

import { useAuth, useSearchBar } from 'src/modules/shared/providers';

import { Logo, Login, SearchBar } from '..';

export const Header = memo(() => {
  const { setFullscreenSearch, fullscreenSearch } = useSearchBar();
  const { isLoading } = useAuth();

  if (isLoading)
    return null;
  
  return (
    <header className={`${styles.header} ${fullscreenSearch ? styles.hideElements : ''}`}>
      <div className={styles.hide}>
        <Logo hideLogoPart />
      </div>
      <SearchBar />
      <div className={`${styles.header__right} ${styles.hide}`}>
        <Button className="btn-light btn-transparent btn-borderless btn-round" onClick={() => setFullscreenSearch(true)}>
					<i className="bi bi-search"></i>
				</Button>
        <Login />
      </div>
    </header>
  );
});

export default Header;
