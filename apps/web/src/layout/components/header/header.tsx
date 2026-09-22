import { memo } from 'react';
import { Form } from 'react-bootstrap';

import styles from './header.module.scss';

import { useAuth, useTheme } from 'src/modules/shared/providers';

import { Logo, Login } from '..';

export const Header = memo(() => {
	const { isLoading } = useAuth();
	const { theme, changeTheme } = useTheme();

	if (isLoading)
		return <div className={styles.header} />;

	return (
		<header className={styles.header}>
			<div className={styles.hide}>
				<Logo hideLogoPart />
			</div>
			<div className={`${styles.header__right} ${styles.hide}`}>
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
