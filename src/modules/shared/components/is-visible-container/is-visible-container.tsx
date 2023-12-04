import debounce from 'lodash.debounce';
import { PropsWithChildren, useEffect, useRef } from 'react';

export type IsVisibleContainerProps = PropsWithChildren<{
	inView?: () => void;
}>

export function IsVisibleContainer({ children, inView }: IsVisibleContainerProps) {
	const ref = useRef<HTMLDivElement>(null);

	const debouncedInView = useRef(
		debounce(() => {
			inView && inView();
		}, 500, {
			leading: true,
			trailing: false
		})
	).current;

	const createCb = () => {
		return (val: IntersectionObserverEntry[]) => {
			if (!val[0].isIntersecting) return;

			debouncedInView();
		};
	}

	useEffect(() => {
		if (!ref?.current) return;
		
		const target = ref.current;

		const options: IntersectionObserverInit = {
			rootMargin: '300px'
		};

		const cb = createCb();
		
		const observer = new IntersectionObserver(cb, options);

		observer.observe(target);

		return () => observer.unobserve(target);
	}, [ref?.current]);

  return (
    <div ref={ref}>
      {children}
    </div>
  );
}

export default IsVisibleContainer;