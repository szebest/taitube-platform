import React from "react";
import { VisibilityContext } from "react-horizontal-scrolling-menu";

import styles from './drag-scroll-arrow.module.scss';

function Arrow({
	children,
	disabled,
	onClick,
	className = ''
}: {
	children: React.ReactNode;
	disabled: boolean;
	onClick: VoidFunction;
	className?: string
}) {
	return (
		<button
			disabled={disabled}
			onClick={onClick}
			className={`btn ${styles.arrow} ${disabled ? styles.disabled : ''} ${className}`}
		>
			{children}
		</button>
	);
}

export function LeftArrow() {
	const {
		getPrevElement,
		isFirstItemVisible,
		scrollToItem,
		visibleElements,
		initComplete
	} = React.useContext(VisibilityContext);

	const [disabled, setDisabled] = React.useState(
		!initComplete || (initComplete && isFirstItemVisible)
	);
	React.useEffect(() => {
		if (visibleElements.length) {
			setDisabled(isFirstItemVisible);
		}
	}, [isFirstItemVisible, visibleElements]);

	const clickHandler = () => scrollToItem(getPrevElement(), "smooth", "start");
	return (
		<Arrow disabled={disabled} onClick={clickHandler}  className={styles.left}>
			<i className="bi bi-arrow-left"></i>
		</Arrow>
	);
}

export function RightArrow() {
	const {
		getNextElement,
		isLastItemVisible,
		scrollToItem,
		visibleElements
	} = React.useContext(VisibilityContext);

	const [disabled, setDisabled] = React.useState(
		!visibleElements.length && isLastItemVisible
	);
	React.useEffect(() => {
		if (visibleElements.length) {
			setDisabled(isLastItemVisible);
		}
	}, [isLastItemVisible, visibleElements]);

	const clickHandler = () => scrollToItem(getNextElement(), "smooth", "end");
	return (
		<Arrow disabled={disabled} onClick={clickHandler} className={styles.right}>
			<i className="bi bi-arrow-right"></i>
		</Arrow>
	);
}
