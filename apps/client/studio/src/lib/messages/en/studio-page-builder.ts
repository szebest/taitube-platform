import { dt } from '@vp/shared-messages';

const SOURCES = {
  videos: 'Videos',
  shorts: 'Shorts',
  posts: 'Posts',
  live: 'Live streams',
  playlists: 'Playlists',
  start_here: 'Start here',
  picked: 'Hand-picked items',
  smart_playlist: 'A smart playlist',
} as const;

const SORTS = {
  newest: 'Newest first',
  popular: 'Most popular',
  oldest: 'Oldest first',
  most_liked: 'Most liked',
  manual: 'The order of the source',
  random: 'Random',
} as const;

const LAYOUTS = {
  shelf: 'Shelf',
  grid: 'Grid',
  list: 'List',
  hero: 'One large item',
  masonry: 'Masonry',
} as const;

const DENSITIES = {
  compact: 'Compact',
  comfortable: 'Comfortable',
} as const;

const SHOWN = {
  duration: 'Show the duration',
  views: 'Show the views',
  date: 'Show the date',
} as const;

const AUDIENCES = {
  everyone: 'Everyone',
  visitors: 'People not subscribed',
  subscribers: 'Subscribers',
  signed_in: 'Signed-in viewers',
} as const;

const BLOCKS = {
  content: 'Videos and more',
  videos: 'Latest videos',
  shorts: 'Shorts',
  posts: 'Posts',
  live: 'Live streams',
  playlists: 'Playlists',
  start_here: 'Start here',
  rich_text: 'Text',
  links: 'Links',
  featured_channels: 'Featured channels',
} as const;

const ICONS = {
  video: 'Video',
  playlist: 'Playlist',
  chat: 'Chat',
  live: 'Live',
  heart: 'Heart',
  flame: 'Flame',
  party: 'People',
  tag: 'Tag',
  globe: 'Globe',
} as const;

const TEMPLATES = {
  creator_starter: 'Creator starter',
  series_focused: 'Series-focused',
  blank: 'Blank',
} as const;

const ABOUT = {
  creator_starter:
    'Start here, latest uploads, popular videos, playlists and featured channels on Home.',
  series_focused:
    'A hero of your newest episode, your series as a grid, Start here and an Episodes tab.',
  blank: 'An empty Home. Every built-in tab stays.',
} as const;

const VIEWS = {
  visitor: 'New visitor',
  subscriber: 'Subscriber',
  mobile: 'Mobile',
} as const;

const STATUSES = {
  saved: 'All changes saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving...',
  invalid: 'Fix the problem below to save',
  failed: 'The draft was not saved',
  conflict: 'Someone else saved a newer draft',
} as const;

const SCHEDULE = {
  draft: 'Publish this draft',
  published: 'Bring the live page back',
} as const;

const LANDING = {
  visitor: 'New visitors open this tab first',
  subscriber: 'Subscribers open this tab first',
} as const;

export const studioPageBuilder = {
  pageNav: dt('Channel page'),
  pageTitle: dt('Channel page'),
  pageDescription: dt(
    'Arrange the tabs and sections of your channel page, see it as a visitor or a subscriber, then publish it or schedule it.'
  ),
  pageForbidden: dt('Your role cannot edit the channel page.'),
  pageTabHidden: dt('Hidden'),
  pageUntitledSection: dt('Untitled section'),
  pagePreviewChannels: dt('{count:plural}', {
    plural: { count: { one: '{?} featured channel', other: '{?} featured channels' } },
  }),
  pageSourceLabel: dt('Source'),
  pageSourceOption: dt('{source:enum}', { enum: { source: SOURCES } }),
  pageSourcePlaylist: dt('Playlist: {title}'),
  pageFilterTags: dt('Only videos with these tags'),
  pageFilterTagsPlaceholder: dt('Add a tag'),
  pageFilterLastDays: dt('Only the last N days'),
  pageFilterMinMinutes: dt('Shortest, in minutes'),
  pageFilterMaxMinutes: dt('Longest, in minutes'),
  pageFilterHideWatched: dt('Hide what a signed-in viewer has watched'),
  pageSortLabel: dt('Sort'),
  pageSortOption: dt('{sort:enum}', { enum: { sort: SORTS } }),
  pageLayoutLabel: dt('Layout'),
  pageLayoutOption: dt('{type:enum}', { enum: { type: LAYOUTS } }),
  pageColumns: dt('Columns: {count:number}'),
  pageColumnsLabel: dt('Columns'),
  pageItemCount: dt('Items: {count:number}'),
  pageItemCountLabel: dt('Number of items'),
  pageSeeAll: dt('"See all" opens'),
  pageSeeAllNone: dt('Nothing'),
  pageTitleLabel: dt('Title'),
  pageSubtitleLabel: dt('Subtitle'),
  pageDensityLabel: dt('Density'),
  pageDensityOption: dt('{density:enum}', { enum: { density: DENSITIES } }),
  pageShowFlag: dt('{field:enum}', { enum: { field: SHOWN } }),
  pageAudienceLabel: dt('Who sees it'),
  pageAudienceOption: dt('{audience:enum}', { enum: { audience: AUDIENCES } }),
  pageHideWhenEmpty: dt('Hide it when it has nothing to show'),
  pageRichTextLabel: dt('Text'),
  pageRichTextHint: dt('Paragraphs, headings, bold, italic, lists and https links. No HTML.'),
  pageLinkLabel: dt('Link {position:number} label'),
  pageLinkUrl: dt('Link {position:number} address'),
  pageLinkRemove: dt('Remove link {position:number}'),
  pageLinkAdd: dt('Add a link'),
  pageChannelRemove: dt('Remove {name}'),
  pageChannelHandle: dt('Channel handle'),
  pageChannelNotFound: dt('No channel has that handle.'),
  pageChannelAdd: dt('Add channel'),
  pageGroupSource: dt('Source'),
  pageGroupFilters: dt('Filters'),
  pageGroupLayout: dt('Sort and layout'),
  pageGroupContent: dt('Content'),
  pageGroupPresentation: dt('Presentation'),
  pageGroupVisibility: dt('Visibility'),
  pageSectionDrawerTitle: dt('Edit {title}'),
  pageSectionDrawerDescription: dt(
    'The preview follows every change. Nothing goes live until you publish.'
  ),
  pageBlockOption: dt('{kind:enum}', { enum: { kind: BLOCKS } }),
  pageBlockDefaultTitle: dt('{kind:enum}', { enum: { kind: BLOCKS } }),
  pageAddSection: dt('Add section'),
  pageAddSectionLabel: dt('Kinds of section'),
  pageAddSectionSearch: dt('Search kinds'),
  pageAddSectionEmpty: dt('No such kind.'),
  pageSectionsLabel: dt('Sections of this tab'),
  pageSectionEdit: dt('Edit {title}'),
  pageSectionShow: dt('Show {title}'),
  pageSectionHide: dt('Hide {title}'),
  pageSectionDuplicate: dt('Duplicate {title}'),
  pageSectionDelete: dt('Delete {title}'),
  pageTabTitle: dt('Tab name'),
  pageTabHide: dt('Hide this tab'),
  pageTabLanding: dt('{audience:enum}', { enum: { audience: LANDING } }),
  pageTabSlug: dt('Address'),
  pageTabSlugHint: dt(
    '3 to 30 letters, digits or dashes. It cannot change once the tab is published.'
  ),
  pageTabIcon: dt('Icon'),
  pageTabIconNone: dt('None'),
  pageTabIconOption: dt('{kind:enum}', { enum: { kind: ICONS } }),
  pageTabDescription: dt('Description'),
  pageTabDuplicate: dt('Duplicate tab'),
  pageTabRemove: dt('Delete tab'),
  pageTabsLabel: dt('Tabs'),
  pageTabShow: dt('Show {title}'),
  pageTabHideNamed: dt('Hide {title}'),
  pageAddTab: dt('Add tab'),
  pageNewTabTitle: dt('New tab'),
  pageFixedTab: dt(
    "This tab is a fixed grid of the channel's content, with the viewer's own sort and filter."
  ),
  pageScheduleTitle: dt('Schedule'),
  pageScheduleDescription: dt(
    'Queue a change of the page for a time of your own clock. Queue the live page to bring it back after a seasonal one.'
  ),
  pageScheduleSource: dt('What goes live'),
  pageScheduleSourceOption: dt('{source:enum}', { enum: { source: SCHEDULE } }),
  pageScheduleAt: dt('At'),
  pageScheduleConfirm: dt('Schedule'),
  pageScheduleCancel: dt('Cancel'),
  pageScheduleCancelled: dt('Schedule cancelled'),
  pageScheduleCancelFailed: dt('The schedule was not cancelled.'),
  pageCancel: dt('Close'),
  pageRevisionsTitle: dt('Published pages'),
  pageRevisionsDescription: dt('Restoring publishes an earlier page again as a new version.'),
  pageRevisionsEmpty: dt('Nothing has been published yet.'),
  pageRevisionsLabel: dt('Published versions of the page'),
  pageRevisionNoNote: dt('No note'),
  pageRestored: dt('Restored version {version:number}'),
  pageRestoreFailed: dt('The page was not restored.'),
  pageTemplates: dt('Templates'),
  pageTemplateTitle: dt('Start from a template'),
  pageTemplateDescription: dt(
    'This replaces your draft. The live page does not change until you publish.'
  ),
  pageTemplateLabel: dt('Templates'),
  pageTemplateOption: dt('{kind:enum}', { enum: { kind: TEMPLATES } }),
  pageTemplateAbout: dt('{kind:enum}', { enum: { kind: ABOUT } }),
  pageTemplateApply: dt('Replace my draft'),
  pagePreviewLabel: dt('Preview'),
  pagePreviewAs: dt('Preview as'),
  pagePreviewOption: dt('{mode:enum}', { enum: { mode: VIEWS } }),
  pagePreviewFrame: dt('{mode:enum}', { enum: { mode: VIEWS } }),
  pageStatus: dt('{status:enum}', { enum: { status: STATUSES } }),
  pageHistory: dt('History'),
  pageSchedule: dt('Schedule'),
  pageSaveDraft: dt('Save draft'),
  pagePublish: dt('Publish'),
  pageGoToProblem: dt('Go to it'),
  pagePublished: dt('Page published'),
  pagePublishFailed: dt('The page was not published.'),
  pageScheduled: dt('Page scheduled'),
  pageScheduleFailed: dt('The page was not scheduled.'),
} as const;
