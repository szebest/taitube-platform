import { type ReactNode, useId } from 'react';

export function ShowcaseSection({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="tw:flex tw:flex-col tw:gap-3">
      <h2 id={titleId} className="tw:m-0 tw:text-lg tw:font-medium">
        {title}
      </h2>
      <div className="tw:flex tw:flex-col tw:gap-3">{children}</div>
    </section>
  );
}
