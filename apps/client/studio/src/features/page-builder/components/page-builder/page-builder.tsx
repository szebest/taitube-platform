import { Icon, IconButton } from '@kit/ui';
import type { ChannelPageDraftView } from '@vp/api-contracts';
import { type ChannelLayout, type LayoutSection, tabSections } from '@vp/domain';
import { useState } from 'react';
import { TabStrip } from '#app/components/page-builder/tab-strip';
import { useDraftEditor } from '#app/features/page-builder/hooks/use-draft-editor';
import {
  addCustomTab,
  addSection,
  canAddSection,
  duplicateSection,
  duplicateTab,
  isPinnedTab,
  removeSection,
  removeTab,
  reorderSections,
  reorderTabs,
  replaceSection,
  type SectionBlock,
  sectionsOf,
  setSectionHidden,
  setTabHidden,
  canAddTab,
} from '#app/features/page-builder/utils/layout-edits';
import type { LayoutProblemTarget } from '#app/features/page-builder/utils/layout-problem';
import { useT } from '#app/lib/messages';
import { AddSectionCommand } from '../add-section-command/add-section-command';
import { PreviewPane } from '../preview-pane/preview-pane';
import { PublishBar } from '../publish-bar/publish-bar';
import { SectionDrawer } from '../section-drawer/section-drawer';
import { SectionList } from '../section-list/section-list';
import { TabEditor } from '../tab-editor/tab-editor';

export interface PageBuilderProps {
  draft: ChannelPageDraftView;
}

/** The channel page being built: its tabs, the sections of the selected one, the publish bar and a preview of the draft. */
export function PageBuilder({ draft }: PageBuilderProps) {
  const { tOr } = useT();
  const editor = useDraftEditor(draft);
  const { document: layout, edit } = editor;
  const [tabId, setTabId] = useState(layout.landing.visitor);
  const [sectionId, setSectionId] = useState<string>();

  const tab = layout.tabs.find(({ id }) => id === tabId) ?? layout.tabs[0];
  const sections: readonly LayoutSection[] = tab ? tabSections(tab) : [];
  const open = sectionsOf(layout).find(({ id }) => id === sectionId);
  const tabs = layout.tabs.map(({ id, title }) => ({ id, title }));

  const goTo = ({ tabId: nextTab, sectionId: nextSection }: LayoutProblemTarget) => {
    setTabId(nextTab);
    setSectionId(nextSection ?? undefined);
  };

  const replaceLayout = (next: ChannelLayout) => {
    edit(next);
    setTabId(next.landing.visitor);
    setSectionId(undefined);
  };

  const addTab = () => {
    const next = addCustomTab(layout, tOr('studio.pageNewTabTitle', {}, ''));
    edit(next);
    setTabId(next.tabs.at(-1)?.id ?? tabId);
  };

  const copyTab = (id: string) => {
    const next = duplicateTab(layout, id);
    edit(next);
    const at = layout.tabs.findIndex((held) => held.id === id);
    setTabId(next.tabs[at + 1]?.id ?? id);
  };

  const dropTab = (id: string) => {
    edit(removeTab(layout, id));
    setTabId('home');
  };

  const add = (block: SectionBlock) => {
    if (tab) {
      edit(
        addSection(layout, tab.id, block, tOr('studio.pageBlockDefaultTitle', { kind: block }, ''))
      );
    }
  };

  return (
    <div className="flex flex-col gap-section">
      <PublishBar editor={editor} onGoTo={goTo} onTemplate={replaceLayout} />
      <TabStrip.Root
        aria-label={tOr('studio.pageTabsLabel', {}, '')}
        ids={layout.tabs.map(({ id }) => id)}
        value={tab?.id ?? ''}
        onValueChange={setTabId}
        onReorder={(order) => edit(reorderTabs(layout, order))}
      >
        {layout.tabs.map((held) => (
          <TabStrip.Tab key={held.id} id={held.id} label={held.title} hidden={held.hidden}>
            {!isPinnedTab(held) && (
              <IconButton
                size="sm"
                aria-label={tOr(
                  held.hidden ? 'studio.pageTabShow' : 'studio.pageTabHideNamed',
                  { title: held.title },
                  ''
                )}
                onClick={() => edit(setTabHidden(layout, held.id, !held.hidden))}
              >
                <Icon name={held.hidden ? 'eye' : 'eye-off'} size="sm" />
              </IconButton>
            )}
          </TabStrip.Tab>
        ))}
        <TabStrip.Add disabled={!canAddTab(layout)} onClick={addTab}>
          {tOr('studio.pageAddTab', {}, '')}
        </TabStrip.Add>
      </TabStrip.Root>
      {tab && (
        <TabEditor
          layout={layout}
          tab={tab}
          onChange={edit}
          onDuplicate={() => copyTab(tab.id)}
          onRemove={() => dropTab(tab.id)}
        />
      )}
      {tab && (tab.kind === 'home' || tab.kind === 'custom') ? (
        <div className="flex flex-col gap-stack">
          <SectionList
            sections={sections}
            canDuplicate={canAddSection(layout, tab.id)}
            onReorder={(order) => edit(reorderSections(layout, tab.id, order))}
            onOpen={setSectionId}
            onToggleHidden={(section) =>
              edit(setSectionHidden(layout, section.id, section.visibility.to === null))
            }
            onDuplicate={(id) => edit(duplicateSection(layout, id))}
            onDelete={(id) => edit(removeSection(layout, id))}
          />
          <div>
            <AddSectionCommand disabled={!canAddSection(layout, tab.id)} onAdd={add} />
          </div>
        </div>
      ) : (
        <p className="m-0 text-body-sm text-fg-muted">{tOr('studio.pageFixedTab', {}, '')}</p>
      )}
      {open && (
        <SectionDrawer
          section={open}
          tabs={tabs}
          onChange={(section) => edit(replaceSection(layout, section))}
          onClose={() => setSectionId(undefined)}
        />
      )}
      <PreviewPane version={editor.version} />
    </div>
  );
}
