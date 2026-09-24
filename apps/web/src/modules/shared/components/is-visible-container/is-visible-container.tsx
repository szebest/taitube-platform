import debounce from 'lodash.debounce';
import { type PropsWithChildren, useEffect, useRef } from 'react';

export type IsVisibleContainerProps = PropsWithChildren<{
	inView?: VoidFunction;
	rootMargin?: string;
}>

type Visibility = Pick<IntersectionObserverEntry, 'isIntersecting'>;

/** @internal */
export function whenIntersecting(onVisible: VoidFunction) {
	return ([entry]: Visibility[]) => {
		if (!entry?.isIntersecting) return;

		onVisible();
	};
}

export function IsVisibleContainer({ children, inView, rootMargin = '100px' }: IsVisibleContainerProps) {
	const ref = useRef<HTMLDivElement>(null);

	const debouncedInView = useRef(
		debounce(() => {
			inView?.();
		}, 500, {
			leading: true,
			trailing: false
		})
	).current;

	useEffect(() => {
		const target = ref.current;
		if (!target) return;

		const observer = new IntersectionObserver(whenIntersecting(debouncedInView), { rootMargin });

		observer.observe(target);

		return () => observer.unobserve(target);
	}, [rootMargin, debouncedInView]);

	return (
		<div ref={ref}>
			{children}
		</div>
	);
}
