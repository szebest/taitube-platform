import { PropsWithChildren, useEffect } from 'react';
import { ScrollMenu, VisibilityContext } from 'react-horizontal-scrolling-menu';

import styles from './drag-scroll-menu.module.scss';

import { useDrag } from '../../hooks';

import { LeftArrow, RightArrow } from '../drag-scroll-arrow/drag-scroll-arrow';

type ScrollVisibilityApiType = React.ContextType<typeof VisibilityContext>;

export type DragScrollMenu = {
	onDraggingChange?: (dragging: boolean) => void
} & PropsWithChildren;

export function DragScrollMenu({ children, onDraggingChange }: DragScrollMenu) {
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
		onDraggingChange && onDraggingChange(dragging)
	}, [dragging, onDraggingChange]);

	return (
		<ScrollMenu
			LeftArrow={<LeftArrow />}
			RightArrow={<RightArrow />}
			scrollContainerClassName={styles.container}
			onMouseDown={() => dragStart}
			onMouseUp={() => dragStop}
			onMouseMove={handleDrag}>
			{children as any}
		</ScrollMenu>
	)
}

export default DragScrollMenu;