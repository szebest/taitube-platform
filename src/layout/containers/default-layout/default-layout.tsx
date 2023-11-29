import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Outlet } from "react-router-dom";

import styles from './default-layout.module.scss';

import { Header } from "src/layout/components";
import { LoadingSpinner } from "src/modules/shared/components";

export type DefaultLayoutProps = {
  maxWidth?: string
}

export function DefaultLayout({ maxWidth = "100%" }: DefaultLayoutProps) {
  return (
    <>
      <Header />
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
    </>
  );
}

export default DefaultLayout;
