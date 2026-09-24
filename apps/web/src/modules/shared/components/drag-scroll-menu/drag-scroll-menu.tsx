import { type ComponentProps, useEffect } from 'react';
import { ScrollMenu, type VisibilityContext } from 'react-horizontal-scrolling-menu';

import styles from './drag-scroll-menu.module.scss';

import { useDrag } from '../../hooks';

import { LeftArrow, RightArrow } from '../drag-scroll-arrow/drag-scroll-arrow';

type ScrollVisibilityApiType = React.ContextType<typeof VisibilityContext>;

export type DragScrollMenuProps = {
	onDraggingChange?: (dragging: boolean) => void
	children: ComponentProps<typeof ScrollMenu>['children']
};

export function DragScrollMenu({ children, onDraggingChange }: DragScrollMenuProps) {
	const { dragStart, dragStop, dragMove, dragging } = useDrag();

	const handleDrag = ({ scrollContainer }: ScrollVisibilityApiType) => (
		ev: React.MouseEvent
	) =>
		dragMove(ev, (posDiff) => {
			if (scrollContainer.current) {
				scrollContainer.current.scrollLeft += posDiff;
			}
		});

	useEffect(() => {
		onDraggingChange?.(dragging)
	}, [dragging, onDraggingChange]);

	return (
		<ScrollMenu
			LeftArrow={<LeftArrow />}
			RightArrow={<RightArrow />}
			scrollContainerClassName={styles.container}
			onMouseDown={() => dragStart}
			onMouseUp={() => dragStop}
			onMouseMove={handleDrag}>
			{children}
		</ScrollMenu>
	)
}
