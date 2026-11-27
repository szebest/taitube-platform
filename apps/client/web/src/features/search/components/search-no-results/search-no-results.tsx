import { EmptyState, NoResultsIllustration } from '@kit/components';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useApi } from '@vp/queries';
import { ChipBar } from '#app/components/discovery/chip-bar';
import { topicsQueryOptions } from '#app/features/search/api/search-queries';
import { useT } from '#app/lib/messages';

export interface SearchNoResultsProps {
  query: string;
}

/** Nothing matched: the words that found nothing, and the topics the catalogue has to start from. */
export function SearchNoResults({ query }: SearchNoResultsProps) {
  const api = useApi();
  const { data: topics = [] } = useQuery(topicsQueryOptions(api));
  const navigate = useNavigate();
  const { tOr } = useT();

  return (
    <EmptyState.Root size="section" role="status">
      <EmptyState.Illustration>
        <NoResultsIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title>
        <h2>{tOr('search.noResults', { query }, '')}</h2>
      </EmptyState.Title>
      <EmptyState.Description>{tOr('search.noResultsHint', {}, '')}</EmptyState.Description>
      {topics.length > 0 && (
        <ChipBar.Root
          aria-label={tOr('search.topicsLabel', {}, '')}
          value=""
          onValueChange={(name) => {
            if (typeof name === 'string') {
              navigate({ to: '/search', search: { q: name } });
            }
          }}
        >
          {topics.map((topic) => (
            <ChipBar.Item key={topic.id} value={topic.name}>
              {topic.name}
            </ChipBar.Item>
          ))}
        </ChipBar.Root>
      )}
    </EmptyState.Root>
  );
}
