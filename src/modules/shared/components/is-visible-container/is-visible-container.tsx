import debounce from 'lodash.debounce';
import { PropsWithChildren, useCallback, useEffect, useRef } from 'react';

export type IsVisibleContainerProps = PropsWithChildren<{
	inView?: VoidFunction;
	rootMargin?: string;
}>

export function IsVisibleContainer({ children, inView, rootMargin = '100px' }: IsVisibleContainerProps) {
	const ref = useRef<HTMLDivElement>(null);

	const debouncedInView = useRef(
		debounce(() => {
			inView && inView();
		}, 500, {
			leading: true,
			trailing: false
		})
	).current;

	const createCb = useCallback(() => {
		return (val: IntersectionObserverEntry[]) => {
			if (!val[0].isIntersecting) return;

			debouncedInView();
		};
	}, [debouncedInView]);

	useEffect(() => {
		if (!ref?.current) return;
		
		const target = ref.current;

		const options: IntersectionObserverInit = {
			rootMargin
		};

		const cb = createCb();
		
		const observer = new IntersectionObserver(cb, options);

		observer.observe(target);

		return () => observer.unobserve(target);
	}, [ref, rootMargin, createCb]);

  return (
    <div ref={ref}>
      {children}
    </div>
  );
}

export default IsVisibleContainer;