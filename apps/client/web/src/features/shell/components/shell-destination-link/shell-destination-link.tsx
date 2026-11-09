import { Link } from '@tanstack/react-router';
import { assertNever } from '@vp/result';
import type { ComponentPropsWithRef } from 'react';
import type { ShellTarget } from '#app/hooks/use-shell-destinations';
import { STUDIO_URL } from '#app/lib/config';

export type ShellDestinationLinkProps = Omit<ComponentPropsWithRef<'a'>, 'href'> & {
  destination: ShellTarget;
};

/** The router link to a shell destination, or the plain one out to the studio. */
export function ShellDestinationLink({ destination, ...props }: ShellDestinationLinkProps) {
  switch (destination.kind) {
    case 'page':
      return <Link to={destination.to} {...props} />;
    case 'channel':
      return (
        <Link to="/channel/$channelId" params={{ channelId: destination.channelId }} {...props} />
      );
    case 'studio':
      return <a href={STUDIO_URL} {...props} />;
    default:
      return assertNever(destination, 'shell target');
  }
}
