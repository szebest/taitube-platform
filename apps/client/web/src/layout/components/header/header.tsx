import { memo } from 'react';

import styles from './header.module.scss';

import { ThemeMenu } from '#app/components/ui/theme/theme-menu';
import { useAuth } from '#app/modules/shared/providers';

import { Logo, Login } from '..';

export const Header = memo(() => {
	const { isLoading } = useAuth();

	if (isLoading)
		return <div className={styles.header} />;

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
