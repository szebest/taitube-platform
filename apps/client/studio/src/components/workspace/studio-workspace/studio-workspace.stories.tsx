import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { PageHeader } from '@vp/components';
import { Button, Icon, Input, Logo, Tooltip } from '@vp/ui';
import { StudioWorkspace, StudioWorkspaceSkeleton } from '.';
import { StudioWorkspaceRoot } from './studio-workspace';

const NAV = [
  { icon: 'home', label: 'Dashboard', href: '/' },
  { icon: 'video', label: 'Videos', href: '/videos' },
  { icon: 'chart', label: 'Analytics', href: '/analytics' },
  { icon: 'chat', label: 'Comments', href: '/comments' },
  { icon: 'settings', label: 'Settings', href: '/settings' },
] as const;

const withTooltips: Decorator = (Story) => (
  <Tooltip.Provider>
    <Story />
  </Tooltip.Provider>
);

function Workspace({ uploading = false }: { uploading?: boolean }) {
  return (
    <>
      <StudioWorkspace.Nav>
        <a
          href="/"
          aria-label="Taitube Studio"
          className="tw:flex tw:h-header tw:items-center tw:px-inline"
        >
          <Logo />
        </a>
        {NAV.map(({ icon, label, href }) => (
          <StudioWorkspace.NavItem key={href} icon={icon} href={href} active={href === '/videos'}>
            {label}
          </StudioWorkspace.NavItem>
        ))}
      </StudioWorkspace.Nav>
      <StudioWorkspace.Toolbar>
        <Input
          aria-label="Search your videos"
          placeholder="Search your videos"
          className="tw:max-w-[20rem]"
        />
        <Button size="sm" className="tw:ms-auto">
          <Icon name="upload" />
          Upload
        </Button>
        {uploading && <StudioWorkspace.Progress aria-label="Uploading" value={42} />}
      </StudioWorkspace.Toolbar>
      <StudioWorkspace.Content>
        <PageHeader.Root>
          <PageHeader.Title>Videos</PageHeader.Title>
        </PageHeader.Root>
        <p>The library table sits here.</p>
      </StudioWorkspace.Content>
      <StudioWorkspace.Inspector title="Shot entirely on a 1998 camcorder: Lisbon at night">
        <p className="tw:m-0">Public, 412,008 views</p>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </StudioWorkspace.Inspector>
    </>
  );
}

const meta = {
  title: 'Studio/StudioWorkspace',
  component: StudioWorkspaceRoot,
  parameters: { layout: 'fullscreen' },
  decorators: [withTooltips],
  globals: { spacing: 'compact', sizing: 'small' },
  render: (args) => (
    <StudioWorkspace.Root {...args}>
      <Workspace />
    </StudioWorkspace.Root>
  ),
} satisfies Meta<typeof StudioWorkspaceRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LargeEmptyInspector: Story = {};

export const LargeSelectedVideo: Story = {
  args: { inspectorOpen: true },
};

export const MediumOverlayInspector: Story = {
  args: { inspectorOpen: true },
  globals: { viewport: { value: 'tablet' } },
};

export const NavCollapsed: Story = {
  globals: { viewport: { value: 'tablet' } },
};

export const CompactDrawerAndSheet: Story = {
  args: { inspectorOpen: true },
  globals: { viewport: { value: 'mobile1' } },
};

export const Uploading: Story = {
  render: (args) => (
    <StudioWorkspace.Root {...args}>
      <Workspace uploading />
    </StudioWorkspace.Root>
  ),
};

export const RightToLeft: Story = {
  args: { inspectorOpen: true },
  globals: { direction: 'rtl' },
};

export const InspectorAtInlineStart: Story = {
  args: { inspectorOpen: true, inspectorSide: 'inline-start' },
};

export const Loading: Story = {
  render: () => <StudioWorkspaceSkeleton />,
};
