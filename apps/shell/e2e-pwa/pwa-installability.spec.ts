import { test, expect } from '@playwright/test';

test('manifest enlazado en <head> con los campos mínimos de instalabilidad', async ({ page }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const manifestResponse = await page.request.get(new URL(manifestHref!, page.url()).toString());
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();

  expect(manifest.name).toBe('The Collector');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  // al menos un icono >= 512x512 — requisito de Chrome para instalabilidad
  expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512')).toBe(true);
});

test('service worker se registra y llega a estado "activated" sin errores', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');

  const swState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    // `ready` resuelve en cuanto hay un worker activo, que puede seguir momentáneamente en
    // estado "activating" antes de que el evento `statechange` a "activated" se dispare —
    // se espera ese evento (con timeout acotado) para evitar una carrera de lectura, sin
    // cambiar la aserción final de la spec (debe llegar a "activated").
    let worker = registration.active;
    const deadline = Date.now() + 5000;
    while (worker && worker.state !== 'activated' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      worker = registration.active;
    }
    return worker?.state ?? null;
  });

  expect(swState).toBe('activated');
  expect(pageErrors).toEqual([]);
});

test('segunda carga funciona con el SW activo, sin errores de consola', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.reload();

  expect(pageErrors).toEqual([]);
  await expect(page.getByText('The Collector')).toBeVisible();
});
