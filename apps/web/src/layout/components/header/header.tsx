import { memo } from 'react';
import { Form } from 'react-bootstrap';

import styles from './header.module.scss';

import { useTheme } from '#app/components/ui/theme/theme-provider';
import { useAuth } from '#app/modules/shared/providers';

import { Logo, Login } from '..';

export const Header = memo(() => {
	const { isLoading } = useAuth();
	const { theme, setPreference } = useTheme();

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
							onChange={() => setPreference(theme === 'light' ? 'dark' : 'light')}
							checked={theme === 'dark'}
						/>
					</Form.Group>
				</div>
				<Login />
			</div>
		</header>
	);
});
