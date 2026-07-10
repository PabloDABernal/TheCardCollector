// FIX QA (Reviewer, commit 89bca10) — cubre el bug del closure de `handleRejection`
// (`die-rejection-view.ts`): dos rechazos rápidos sobre el MISMO dado (segundo tap antes de que el
// `delayedCall` de restauración del primero dispare) dejaban el dado con tinte rojo permanente,
// porque cada llamada recapturaba `originFillColor` desde `rect.fillColor` (que en el segundo tap ya
// era el rojo transitorio del primero) y no cancelaba el `delayedCall` previo. Usa
// `createFakeBoardScene({ autoComplete: false })` para controlar manualmente la temporización del
// `delayedCall`, mismo patrón que `nucleo-pool-view.test.ts` usa para tweens (H2.12).
import { describe, it, expect } from 'vitest';
import { createDieRejectionView } from './die-rejection-view';
import { createRejectionSignal } from '../interaction/rejection-signal';
import { createFakeBoardScene } from './test-utils/fake-board-scene';

const FLASH_COLOR = 0xd23c3c;
const DIE_ID = 'die-1';
const ORIGINAL_COLOR = 0x336699;

describe('createDieRejectionView (FIX QA, bug del closure de color)', () => {
  it('un solo rechazo: flashea a rojo y restaura el color original tras el delay', () => {
    const { scene, rectangles, recordedDelayedCalls, runDelayedCall } = createFakeBoardScene({ autoComplete: false });
    const rect = scene.add.rectangle(0, 0, 10, 10, ORIGINAL_COLOR);
    rect.setData('targetId', DIE_ID);
    const { signal, emit } = createRejectionSignal();
    createDieRejectionView(scene, signal);

    emit(DIE_ID);

    expect(rectangles[0]!.fillColor).toBe(FLASH_COLOR);
    expect(recordedDelayedCalls).toHaveLength(1);

    runDelayedCall(0);

    expect(rectangles[0]!.fillColor).toBe(ORIGINAL_COLOR);
  });

  it('dos rechazos rápidos sobre el MISMO dado (antes de que el primer flash termine) terminan con el color REAL, no con rojo permanente', () => {
    const { scene, rectangles, recordedDelayedCalls, runDelayedCall } = createFakeBoardScene({ autoComplete: false });
    const rect = scene.add.rectangle(0, 0, 10, 10, ORIGINAL_COLOR);
    rect.setData('targetId', DIE_ID);
    const { signal, emit } = createRejectionSignal();
    createDieRejectionView(scene, signal);

    // Tap 1 (t=0): flashea a rojo, agenda delayedCall[0] para restaurar.
    emit(DIE_ID);
    expect(rectangles[0]!.fillColor).toBe(FLASH_COLOR);

    // Tap 2 (t=50, antes de que delayedCall[0] dispare a t=280): el color "verdadero" cacheado debe
    // seguir siendo ORIGINAL_COLOR (no el rojo transitorio actual), y delayedCall[0] debe cancelarse.
    emit(DIE_ID);
    expect(rectangles[0]!.fillColor).toBe(FLASH_COLOR);
    expect(recordedDelayedCalls).toHaveLength(2);
    expect(recordedDelayedCalls[0]!.cancelled).toBe(true);

    // delayedCall[0] (viejo, ya cancelado) no debe hacer nada aunque se dispare "tarde".
    runDelayedCall(0);
    expect(rectangles[0]!.fillColor).toBe(FLASH_COLOR);

    // delayedCall[1] (el vigente) restaura al color REAL, no a rojo.
    runDelayedCall(1);
    expect(rectangles[0]!.fillColor).toBe(ORIGINAL_COLOR);
  });
});
