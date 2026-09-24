import { useCallback, useMemo, useState } from 'react';

import { categoriesApi } from 'src/modules/shared/api';
import { DragScrollMenu } from 'src/modules/shared/components';

export type CategoryListProps = {
	onCategoryChange: (categoryId: string | undefined) => void;
	selectedCategoryId: string | undefined;
}

export function CategoryList({ onCategoryChange, selectedCategoryId }: CategoryListProps) {
	const [dragging, setDragging] = useState(false);

	const { data } = categoriesApi.useCategoriesQuery();

	const categories = useMemo(
		() => [{ id: undefined, name: 'All' }, ...(data ?? [])],
		[data]
	);

	const onDraggingChange = useCallback((dragging: boolean) => {
		setDragging(dragging);
	}, []);

	const handleCategoryChange = (categoryId: string | undefined) => {
		if (dragging) return;

		onCategoryChange(categoryId);
	}

	return (
		<DragScrollMenu onDraggingChange={onDraggingChange}>
			{
				categories.map(x => (
					<button type="button" key={x.id ?? 'all'} className={`btn ${selectedCategoryId === x.id ? 'btn-dark' : 'btn-light'}`} onClick={() => handleCategoryChange(x.id)}>{x.name}</button>
				))
			}
		</DragScrollMenu>
	)
}
