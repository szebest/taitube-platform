import {
  ThreadPanelAnchor,
  ThreadPanelBody,
  ThreadPanelComposer,
  ThreadPanelHeader,
  ThreadPanelReplies,
  ThreadPanelRoot,
  ThreadPanelTitle,
} from './thread-panel';

export const ThreadPanel = {
  Root: ThreadPanelRoot,
  Header: ThreadPanelHeader,
  Title: ThreadPanelTitle,
  Anchor: ThreadPanelAnchor,
  Body: ThreadPanelBody,
  Replies: ThreadPanelReplies,
  Composer: ThreadPanelComposer,
};

export { useThreadPanel } from './thread-panel.context';
