import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Outlet } from "@tanstack/react-router";

import styles from './default-layout.module.scss';

import { Header, Sidebar } from "#app/layout/components";
import { LoadingSpinner } from "#app/modules/shared/components";
import { useSidebar } from "#app/modules/shared/providers";

export type DefaultLayoutProps = {
	maxWidth?: string
}

export function DefaultLayout({ maxWidth = "1920px" }: DefaultLayoutProps) {
	const { isBelowBreakpoint } = useSidebar();

	return (
		<>
			<Header />
			<div className={`${styles.container} ${isBelowBreakpoint ? styles.breakpoint : ''}`}>
				<div className={styles.container__sidebar}>
					<Sidebar />
				</div>
				<main>
					<div className={styles.pageWrapper}>
						<div className={styles.pageWrapper__container} style={{ maxWidth }}>
							<ErrorBoundary fallback={<div>There was an error while loading the page</div>}>
								<Suspense fallback={<div style={{ width: "100%" }}><LoadingSpinner /></div>}>
									<Outlet />
								</Suspense>
							</ErrorBoundary>
						</div>
					</div>
				</main>
			</div>
		</>
	);
}
