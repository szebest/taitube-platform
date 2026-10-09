import { type ReactNode, useContext } from "react";
import { VisibilityContext } from "react-horizontal-scrolling-menu";

import styles from './drag-scroll-arrow.module.scss';

function Arrow({
	children,
	disabled,
	onClick,
	className = ''
}: {
	children: ReactNode;
	disabled: boolean;
	onClick: VoidFunction;
	className?: string
}) {
	return (
		<div className={`${styles.container} ${className} ${disabled ? styles.disabled : ''}`}>
			<button type="button"
				disabled={disabled}
				onClick={onClick}
				className={`btn btn-transparent btn-round ${styles.arrow}`}
			>
				{children}
			</button>
		</div>
	);
}

export function LeftArrow() {
	const visibility = useContext(VisibilityContext);
	const isFirstItemVisible = visibility.useIsVisible("first", true);

	return (
		<Arrow
			disabled={isFirstItemVisible}
			onClick={() => visibility.scrollPrev("smooth", "start")}
			className={styles.left}
		>
			<i className="bi bi-arrow-left" />
		</Arrow>
	);
}

export function RightArrow() {
	const visibility = useContext(VisibilityContext);
	const isLastItemVisible = visibility.useIsVisible("last", false);

	return (
		<Arrow
			disabled={isLastItemVisible}
			onClick={() => visibility.scrollNext("smooth", "end")}
			className={styles.right}
		>
			<i className="bi bi-arrow-right" />
		</Arrow>
	);
}
