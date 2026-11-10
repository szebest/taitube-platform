import type { Meta, StoryObj } from '@storybook/react-vite';
import { FALLBACK_ACTIVE_LOCALE, IntlProvider } from '@vp/intl-react';
import { Field, Input } from '@vp/ui';
import { CustomizationSection } from '../index';

const meta = {
  title: 'Studio/CustomizationSection',
  component: CustomizationSection.Root,
} satisfies Meta<typeof CustomizationSection.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

function Section({
  saving = false,
  saved = false,
  failure,
}: {
  saving?: boolean;
  saved?: boolean;
  failure?: string;
}) {
  return (
    <IntlProvider
      locale={FALLBACK_ACTIVE_LOCALE.locale}
      catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
      timeZone="UTC"
    >
      <CustomizationSection.Root className="w-[32rem]">
        <CustomizationSection.Header>
          <CustomizationSection.Title>Identity</CustomizationSection.Title>
          <CustomizationSection.Description>The name viewers see.</CustomizationSection.Description>
        </CustomizationSection.Header>
        <CustomizationSection.Body>
          <Field.Root>
            <Field.Label>Name</Field.Label>
            <Input defaultValue="The Creator" />
          </Field.Root>
        </CustomizationSection.Body>
        <CustomizationSection.Footer saving={saving} saved={saved} failure={failure} />
      </CustomizationSection.Root>
    </IntlProvider>
  );
}

export const Idle: Story = { render: () => <Section /> };

export const Saving: Story = { render: () => <Section saving /> };

export const Saved: Story = { render: () => <Section saved /> };

export const Failed: Story = { render: () => <Section failure="This section was not saved." /> };
