import { useT } from '@vp/intl-react';
import { Button, Card, createCompoundContext } from '@vp/ui';
import { type ComponentPropsWithRef, useId, useMemo } from 'react';

const [SectionContext, useSection] = createCompoundContext<{ titleId: string }>(
  'CustomizationSection'
);

function SectionRoot({ children, ...props }: ComponentPropsWithRef<'form'>) {
  const titleId = useId();
  const shared = useMemo(() => ({ titleId }), [titleId]);

  return (
    <SectionContext value={shared}>
      <Card.Root asChild>
        <form aria-labelledby={titleId} noValidate {...props}>
          {children}
        </form>
      </Card.Root>
    </SectionContext>
  );
}

function SectionHeader(props: ComponentPropsWithRef<'div'>) {
  return <Card.Header {...props} />;
}

function SectionTitle({ children }: ComponentPropsWithRef<'h2'>) {
  const { titleId } = useSection('Title');

  return (
    <Card.Title asChild>
      <h2 id={titleId}>{children}</h2>
    </Card.Title>
  );
}

function SectionDescription(props: ComponentPropsWithRef<'p'>) {
  return <Card.Description {...props} />;
}

function SectionBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <Card.Body className={className ?? 'tw:flex tw:flex-col tw:gap-stack'} {...props} />;
}

interface SectionFooterProps {
  saving: boolean;
  saved: boolean;
  failure?: string;
  disabled?: boolean;
}

/** The section's own save, and what the last save came to. */
function SectionFooter({ saving, saved, failure, disabled = false }: SectionFooterProps) {
  const { tOr } = useT();
  const outcome = failure ?? (saved ? tOr('studio.sectionSaved', {}, '') : undefined);

  return (
    <Card.Footer>
      <p
        role={failure === undefined ? 'status' : 'alert'}
        className="tw:m-0 tw:me-auto tw:text-caption tw:text-fg-muted"
      >
        {saving ? tOr('studio.sectionSaving', {}, '') : outcome}
      </p>
      <Button type="submit" loading={saving} disabled={disabled}>
        {tOr('studio.saveSection', {}, '')}
      </Button>
    </Card.Footer>
  );
}

export const CustomizationSection = {
  Root: SectionRoot,
  Header: SectionHeader,
  Title: SectionTitle,
  Description: SectionDescription,
  Body: SectionBody,
  Footer: SectionFooter,
};
