import { Dialog, Drawer, useUiCopy } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { useStudioWorkspace } from './studio-workspace.context';
import { studioWorkspaceStyles } from './studio-workspace.variants';

export interface StudioWorkspaceInspectorProps extends ComponentPropsWithRef<'aside'> {
  /** Names the aside, and heads it while an item is open. */
  title: string;
}

/**
 * The selected item's details: docked beside the content on a large screen, with its empty line
 * until something is chosen; a side panel below that, and a bottom sheet on a compact screen.
 */
export function StudioWorkspaceInspector({
  title,
  className,
  children,
  ...props
}: StudioWorkspaceInspectorProps) {
  const { layout, inspectorOpen, setInspectorOpen, inspectorSide } =
    useStudioWorkspace('Inspector');
  const { inspectorEmpty } = useUiCopy();
  const styles = studioWorkspaceStyles({ inspectorSide });

  if (layout === 'three-column') {
    return (
      <aside
        data-slot="studio-workspace-inspector"
        data-state={inspectorOpen ? 'open' : 'empty'}
        aria-label={title}
        tabIndex={-1}
        className={styles.inspector({ className })}
        {...props}
      >
        {inspectorOpen ? (
          <>
            <h2 className={styles.inspectorTitle()}>{title}</h2>
            {children}
          </>
        ) : (
          <p className={styles.inspectorEmpty()}>{inspectorEmpty}</p>
        )}
      </aside>
    );
  }

  if (layout === 'two-column') {
    return (
      <Dialog.Root open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <Dialog.Content
          side={inspectorSide}
          aria-describedby={undefined}
          data-slot="studio-workspace-inspector"
          className={styles.overlay({ className })}
        >
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>{children}</Dialog.Body>
        </Dialog.Content>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root open={inspectorOpen} onOpenChange={setInspectorOpen}>
      <Drawer.Content
        aria-describedby={undefined}
        data-slot="studio-workspace-inspector"
        className={className}
      >
        <Drawer.Handle />
        <Drawer.Title>{title}</Drawer.Title>
        <Drawer.Body>{children}</Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
