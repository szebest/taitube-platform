import type { ComponentPropsWithRef } from 'react';

export interface ClipDetailsProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  title: string;
}

/** What sits under a clip's player: its title and the actions open to the viewer. */
export function ClipDetails({ title, children, ...props }: ClipDetailsProps) {
  return (
    <div data-slot="clip-details" className="flex min-w-0 flex-col gap-stack" {...props}>
      <h1 className="m-0 text-title-lg large:text-headline">{title}</h1>
      <div className="flex flex-wrap items-center gap-inline">{children}</div>
    </div>
  );
}
