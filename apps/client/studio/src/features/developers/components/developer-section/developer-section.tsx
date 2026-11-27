import { Card } from '@kit/ui';
import { type PropsWithChildren, type ReactNode, useId } from 'react';

export interface DeveloperSectionProps extends PropsWithChildren {
  title: string;
  description: string;
  /** What the section creates, beside its title. */
  action?: ReactNode;
}

/** One block of the developer page; it lists records and changes each in place, so it has no save of its own. */
export function DeveloperSection({ title, description, action, children }: DeveloperSectionProps) {
  const titleId = useId();

  return (
    <Card.Root asChild>
      <section aria-labelledby={titleId}>
        <Card.Header className="flex flex-wrap items-start justify-between gap-inline">
          <div className="flex min-w-0 flex-col gap-1">
            <Card.Title asChild>
              <h2 id={titleId}>{title}</h2>
            </Card.Title>
            <Card.Description>{description}</Card.Description>
          </div>
          {action}
        </Card.Header>
        <Card.Body className="flex flex-col gap-stack">{children}</Card.Body>
      </section>
    </Card.Root>
  );
}
