import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Outlet } from "react-router-dom";

import styles from './default-layout.module.scss';

import { Header, Sidebar } from "src/layout/components";
import { LoadingSpinner } from "src/modules/shared/components";
import { useSidebar } from "src/modules/shared/providers";

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
        {isBelowBreakpoint !== undefined &&
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
				}
      </div>
    </>
  );
}

export default DefaultLayout;
