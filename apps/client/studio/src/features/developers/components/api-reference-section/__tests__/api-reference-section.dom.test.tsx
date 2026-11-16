import { screen, within } from '@testing-library/react';
import { API_SCOPES } from '@vp/domain';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';
import { API_PUBLIC_URL } from '#app/lib/config';

const reference = () => screen.getByRole('region', { name: 'API reference' });

describe('apps/client/studio: ApiReferenceSection', () => {
  it('links the OpenAPI document and its reading view on the API', async () => {
    await renderDevelopers();

    expect(within(reference()).getByRole('link', { name: 'OpenAPI document' })).toHaveAttribute(
      'href',
      `${API_PUBLIC_URL}/openapi.json`
    );
    expect(within(reference()).getByRole('link', { name: 'Browse the reference' })).toHaveAttribute(
      'href',
      `${API_PUBLIC_URL}/docs`
    );
  });

  it('gives a copy-ready curl for every scope', async () => {
    const { user } = await renderDevelopers();

    for (const scope of API_SCOPES) {
      expect(
        within(reference()).getByRole('button', { name: `Copy curl for ${scope}` })
      ).toBeInTheDocument();
    }
    await user.click(
      within(reference()).getByRole('button', { name: 'Copy curl for exports:create' })
    );

    expect(await navigator.clipboard.readText()).toBe(
      `curl -X POST "${API_PUBLIC_URL}/v1/me/channel/exports" \\\n  -H "Authorization: Bearer $TAITUBE_TOKEN" \\\n  --json '{"kind":"video_analytics","format":"csv"}'`
    );
  });
});
