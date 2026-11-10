import { useT } from '@vp/intl-react';
import { Card } from '@vp/ui';
import type { PropsWithChildren } from 'react';
import { CustomizationSection } from '#app/components/section/customization-section';
import type { useSettingsSection } from '#app/features/comments/hooks/use-settings-section';

export interface SettingsSectionProps extends PropsWithChildren {
  title: string;
  description: string;
  section: Pick<
    ReturnType<typeof useSettingsSection>,
    'dirty' | 'saving' | 'saved' | 'failed' | 'save'
  >;
}

/** One block of the comment settings with its own save; what it holds is the section's own fields. */
export function SettingsSection({ title, description, section, children }: SettingsSectionProps) {
  const { tOr } = useT();

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        section.save();
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>{title}</CustomizationSection.Title>
        <CustomizationSection.Description>{description}</CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>{children}</CustomizationSection.Body>
      <CustomizationSection.Footer
        saving={section.saving}
        saved={section.saved}
        failure={section.failed ? tOr('studio.sectionNotSaved', {}, '') : undefined}
        disabled={!section.dirty}
      />
    </CustomizationSection.Root>
  );
}

export interface SettingsListSectionProps extends PropsWithChildren {
  title: string;
  description: string;
}

/** A block of the comment settings that lists records and changes each one where it stands, so it has no save of its own. */
export function SettingsListSection({ title, description, children }: SettingsListSectionProps) {
  return (
    <Card.Root asChild>
      <section aria-label={title}>
        <Card.Header>
          <Card.Title asChild>
            <h2>{title}</h2>
          </Card.Title>
          <Card.Description>{description}</Card.Description>
        </Card.Header>
        <Card.Body className="flex flex-col gap-stack">{children}</Card.Body>
      </section>
    </Card.Root>
  );
}
