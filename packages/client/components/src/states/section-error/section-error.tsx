import { Button, Icon, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { SectionErrorContext, useSectionError } from './section-error.context';
import { sectionErrorStyles } from './section-error.variants';
import type { SectionErrorLayout, SectionErrorTone } from './types';

export interface SectionErrorRootProps extends ComponentPropsWithRef<'div'> {
  layout?: SectionErrorLayout;
  tone?: SectionErrorTone;
  /** Reloads only this section. */
  onRetry: () => void;
}

/**
 * One section failed inside a page that did not. Its height is the caller's `className` or `style`,
 * the loaded section's, so nothing below shifts; `role="alert"` when it replaces content already shown.
 */
export function SectionErrorRoot({
  layout = 'bar',
  tone = 'danger',
  onRetry,
  className,
  children,
  ...props
}: SectionErrorRootProps) {
  const shared = useMemo(() => ({ layout, tone, retry: onRetry }), [layout, tone, onRetry]);
  const styles = sectionErrorStyles({ layout, tone });
  const { retry } = useUiCopy();

  return (
    <SectionErrorContext value={shared}>
      <div data-slot="section-error" className={styles.root({ className })} {...props}>
        <Icon name="alert" className={styles.icon()} />
        <div className={styles.text()}>{children}</div>
        <Button data-slot="section-error-retry" variant="outline" size="sm" onClick={onRetry}>
          {retry}
        </Button>
      </div>
    </SectionErrorContext>
  );
}

export function SectionErrorMessage({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useSectionError('Message');

  return (
    <p
      data-slot="section-error-message"
      className={sectionErrorStyles(shared).message({ className })}
      {...props}
    />
  );
}

export function SectionErrorSupport({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useSectionError('Support');

  return (
    <p
      data-slot="section-error-support"
      className={sectionErrorStyles(shared).support({ className })}
      {...props}
    />
  );
}
