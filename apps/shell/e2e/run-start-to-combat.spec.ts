import { test, expect } from '@playwright/test';

/**
 * H2.14 spec §5.3 — verificación manual complementaria (NO gate de CI, mismo criterio no-CI que el
 * resto de `apps/shell/e2e/*.spec.ts`). Navega a `/run-start` contra el dev server real de
 * `apps/shell`, elige un Líder real por radio, confirma la navegación real a `/combat` y que el
 * Líder elegido en `RunStartScreen` es efectivamente el que aparece en el HUD de combate — texto
 * real en el DOM (`CombatHud.tsx` §3.4), no una comparación de píxeles del canvas.
 */
test('elegir "Mago Base" en RunStartScreen navega a /combat y el HUD muestra el Líder elegido', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/run-start');

  await expect(page.getByText('Mago Base')).toBeVisible();

  await page.getByText('Mago Base').click();
  await page.getByText('Iniciar combate').click();

  await expect(page).toHaveURL(/\/combat/);
  await expect(page.locator('#phaser-mount canvas')).toBeVisible();
  // H4 spec §6 — `CombatHud` ya no prefija "Líder: ", solo el nombre; se acota al contenedor
  // `.combat-hud` porque el mismo nombre también aparece en `CombatBoardOverlay` (línea de rol).
  await expect(page.locator('.combat-hud')).toContainText('Mago Base');

  expect(pageErrors).toEqual([]);
});

test('regresión — no tocar el selector en RunStartScreen navega a /combat con el Líder por defecto (Soldado Base)', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/run-start');

  await expect(page.getByText('Soldado Base')).toBeVisible();

  await page.getByText('Iniciar combate').click();

  await expect(page).toHaveURL(/\/combat/);
  await expect(page.locator('#phaser-mount canvas')).toBeVisible();
  await expect(page.locator('.combat-hud')).toContainText('Soldado Base');

  expect(pageErrors).toEqual([]);
});
