import { expect, test } from '../../../../tests/playwright/fixtures';

const EXPORT_TIMEOUT_MS = 60_000;

interface ExportDetail {
  id: string;
  status: string;
  downloadUrl: string | null;
}

test.describe('developers', () => {
  test.setTimeout(EXPORT_TIMEOUT_MS + 30_000);

  test('a token made in the studio calls the API, and an export requested there downloads', async ({
    page,
    signIn,
    api,
  }) => {
    await signIn('creator');
    await page.goto('/developers');

    const tokens = page.getByRole('region', { name: 'Personal access tokens' });
    await tokens.getByRole('button', { name: 'Create token' }).click();
    const form = page.getByRole('dialog', { name: 'Create a personal access token' });
    const name = `e2e ${test.info().testId}`;
    await form.getByRole('textbox', { name: /Name/ }).fill(name);
    await form.getByRole('checkbox', { name: 'List and download exports' }).click();
    await form.getByRole('button', { name: 'Create token' }).click();

    const reveal = page.getByRole('dialog', { name: 'Copy your token' });
    const secret = await reveal.getByRole('textbox', { name: /^Token for/ }).inputValue();
    expect(secret).toMatch(/^tt_pat_[0-9a-f]{8}_[0-9a-f]{64}$/);
    await expect(reveal.getByRole('button', { name: 'Done' })).toBeDisabled();
    await reveal.getByRole('checkbox', { name: 'I saved this token somewhere safe' }).click();
    await reveal.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(secret)).toHaveCount(0);

    const script = await api();
    const bearer = { authorization: `Bearer ${secret}` };
    expect((await script.get('/v1/me/channel/exports', { headers: bearer })).status()).toBe(200);
    expect((await script.get('/v1/me/api-tokens', { headers: bearer })).status()).toBe(403);

    const exports = page.getByRole('region', { name: 'Exports' });
    await exports.getByRole('button', { name: 'Request export' }).click();
    const request = page.getByRole('dialog', { name: 'Request an export' });
    await request.getByRole('combobox', { name: 'Data' }).click();
    await page.getByRole('option', { name: 'Videos' }).click();
    const requested = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/v1/me/channel/exports')
    );
    await request.getByRole('button', { name: 'Request export' }).click();
    const { id } = (await (await requested).json()) as ExportDetail;

    await expect(exports.getByRole('button', { name: 'Download the Videos export' })).toBeVisible({
      timeout: EXPORT_TIMEOUT_MS,
    });
    const detail = (await (
      await script.get(`/v1/me/channel/exports/${id}`, { headers: bearer })
    ).json()) as ExportDetail;
    expect(detail.status).toBe('ready');
    const file = await script.get(detail.downloadUrl ?? '');
    expect(file.status()).toBe(200);
    expect((await file.text()).split('\n')[0]).toContain('videoId');

    const owner = await api('creator');
    expect((await owner.delete(`/v1/me/channel/exports/${id}`)).status()).toBe(204);
    await tokens.getByRole('button', { name: `Revoke ${name}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke' }).click();
    await expect
      .poll(async () => (await script.get('/v1/me/channel/exports', { headers: bearer })).status())
      .toBe(401);
  });
});
