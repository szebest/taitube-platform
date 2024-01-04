import { useCallback, useMemo, useState } from 'react';

import { getCategories } from 'src/modules/shared/helpers';
import { DragScrollMenu } from 'src/modules/shared/components';

export type CategoryListProps = {
	onCategoryChange: (categoryId: number | undefined) => void;
	selectedCategoryId: number | undefined;
}

export function CategoryList({ onCategoryChange, selectedCategoryId }: CategoryListProps) {
	const [dragging, setDragging] = useState(false);

	const categories = useMemo(() => {
		const categories: { id: number | undefined, value: string }[] = getCategories();
		categories.unshift({
			id: undefined,
			value: 'All'
		});

		return categories;
	}, []);

	const onDraggingChange = useCallback((dragging: boolean) => {
		setDragging(dragging);
	}, []);

	const handleCategoryChange = (categoryId: number | undefined) => {
		if (dragging) return;

		onCategoryChange(categoryId);
	}

	return (
		<DragScrollMenu onDraggingChange={onDraggingChange}>
			{
				categories.map(x => (
					<button key={x.id} className={`btn ${selectedCategoryId === x.id ? 'btn-secondary' : 'btn-light'}`} onClick={() => handleCategoryChange(x.id)}>{x.value}</button>
				))
			}
		</DragScrollMenu>
	)
}

export default CategoryList;
