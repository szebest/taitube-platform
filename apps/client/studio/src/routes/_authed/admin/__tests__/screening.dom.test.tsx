import { screen } from '@testing-library/react';
import { renderScreening, screeningCase } from '#app/features/admin/__tests__/screening.fixture';

describe('apps/client/studio: /admin/screening', () => {
  it('shows the held and flagged cases under a title and the rule that a score is no verdict', async () => {
    const held = screeningCase({ title: 'Stolen clip' });
    await renderScreening('/admin/screening', { cases: [[held]] });

    expect(await screen.findByRole('heading', { name: 'Held and flagged' })).toBeInTheDocument();
    expect(screen.getByText(/never a verdict/)).toBeInTheDocument();
    expect(await screen.findByText('Stolen clip')).toBeInTheDocument();
  });

  it('keeps the state filter of the URL and reads one the contract refuses as absent', async () => {
    const { router, requests } = await renderScreening('/admin/screening?state=decided&junk=1');
    await screen.findByRole('combobox', { name: 'Show' });
    expect(router.state.location.search).toMatchObject({ state: 'decided' });
    expect(requests.queries[0]?.get('state')).toBe('decided');
  });

  it('reads a state the contract refuses as no filter', async () => {
    const { requests } = await renderScreening('/admin/screening?state=old');
    await screen.findByRole('combobox', { name: 'Show' });

    expect(requests.queries[0]?.has('state')).toBe(false);
  });
});
