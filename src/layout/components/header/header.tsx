import { memo } from 'react';
import { Button, Form } from 'react-bootstrap';

import styles from './header.module.scss';

import { useAuth, useSearchBar, useTheme } from 'src/modules/shared/providers';

import { Logo, Login, SearchBar } from '..';

export const Header = memo(() => {
	const { setFullscreenSearch, fullscreenSearch } = useSearchBar();
	const { isLoading } = useAuth();
	const { theme, changeTheme } = useTheme();

	if (isLoading)
		return <div className={styles.header}></div>;

	return (
		<header className={`${styles.header} ${fullscreenSearch ? styles.hideElements : ''}`}>
			<div className={styles.hide}>
				<Logo hideLogoPart />
			</div>
			<SearchBar />
			<div className={`${styles.header__right} ${styles.hide}`}>
				<Button className="btn-light btn-transparent btn-borderless btn-round" onClick={() => setFullscreenSearch(true)} aria-label='expand search'>
					<i className="bi bi-search"></i>
				</Button>
				<div>
					<Form.Group className={styles.theme} controlId="theme-switch">
						<Form.Label>{theme}</Form.Label>
						<Form.Check
							type="switch"
							aria-label='theme switch'
							onChange={() => changeTheme(theme === 'light' ? 'dark' : 'light')}
							checked={theme === 'dark'}
						/>
					</Form.Group>
				</div>
				<Login />
			</div>
		</header>
	);
});

export default Header;
