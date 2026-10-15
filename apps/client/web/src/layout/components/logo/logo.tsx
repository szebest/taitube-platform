import { Link } from '@tanstack/react-router';
import { BrandLogo } from '@vp/ui';

import styles from './logo.module.scss';

import { useSidebar } from '#app/modules/shared/providers';

export type LogoProps = {
  hideLogoPart: boolean;
};

export function Logo({ hideLogoPart }: LogoProps) {
  const { toggle, close } = useSidebar();

  return (
    <div className={styles.logo}>
      <button
        type="button"
        className="btn btn-transparent btn-round"
        onClick={toggle}
        aria-label="toggle sidebar"
      >
        <i className="bi bi-list" />
      </button>
      <Link to="/" onClick={close}>
        <BrandLogo compact={hideLogoPart} />
      </Link>
    </div>
  );
}
