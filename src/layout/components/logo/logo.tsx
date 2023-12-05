import { Link } from "react-router-dom";

import styles from "./logo.module.scss";

import { useSidebar } from "src/modules/shared/providers";

export function Logo() {
	const { toggle, close } = useSidebar();

	return (
		<div className={styles.logo}>
			<button
				type="button"
				className="btn btn-round"
				onClick={toggle}
			>
				<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" style={{ pointerEvents: 'none', display: 'block', width: '100%', height: '100%' }}><path d="M21 6H3V5h18v1zm0 5H3v1h18v-1zm0 6H3v1h18v-1z"></path></svg>
			</button>
			<Link to="/" onClick={close}>
				<h6>YOUTUBE</h6>
			</Link>
		</div>
	);
}

export default Logo;
