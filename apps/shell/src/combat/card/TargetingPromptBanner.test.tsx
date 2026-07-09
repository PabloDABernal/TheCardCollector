// Fix Reviewer post-H4 (`docs/specs/H4_componente_carta.md` §5.3) — `TargetingPromptBanner.tsx` no
// tenía ningún test propio. Cubre el helper puro `promptLabelFor` (mapeo de `TargetingPrompt` a
// texto de banner) y el render/no-render del componente según `prompt.kind`.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TargetingPrompt } from '@collector/combat-scene';

// `TargetingPromptBanner.tsx` importa `chipStyle` de `../CombatHud`, que a su vez importa
// `isAnyLeaderAbilityActivatable` (valor, no solo tipo) de `@collector/combat-scene` — cuyo barrel
// (`src/index.ts`) también reexporta `CombatScene`, arrastrando `phaser`/`CanvasFeatures` y
// rompiendo bajo jsdom. Mismo mock mínimo que `CombatHud.test.tsx`.
vi.mock('@collector/combat-scene', () => ({
  isAnyLeaderAbilityActivatable: (): boolean => false,
}));

// eslint-disable-next-line import/first -- debe importarse después del `vi.mock` de arriba
import { TargetingPromptBanner, promptLabelFor } from './TargetingPromptBanner';

describe('promptLabelFor', () => {
  it('AWAITING_ATTACK_TARGET → "Elige un objetivo para «cardName»"', () => {
    const prompt: TargetingPrompt = {
      kind: 'AWAITING_ATTACK_TARGET',
      cardName: 'Golpe Certero',
      validTargetIds: [],
    };
    expect(promptLabelFor(prompt)).toBe('Elige un objetivo para «Golpe Certero»');
  });

  it('AWAITING_NUCLEO_FOR_CARD → "Elige un Núcleo para «cardName»"', () => {
    const prompt: TargetingPrompt = {
      kind: 'AWAITING_NUCLEO_FOR_CARD',
      cardName: 'Escudo',
      validDieIds: [],
    };
    expect(promptLabelFor(prompt)).toBe('Elige un Núcleo para «Escudo»');
  });

  it('AWAITING_NUCLEO_FOR_ABILITY → "Elige un Núcleo para «abilityName»"', () => {
    const prompt: TargetingPrompt = {
      kind: 'AWAITING_NUCLEO_FOR_ABILITY',
      abilityName: 'Golpe Rápido',
      validDieIds: [],
    };
    expect(promptLabelFor(prompt)).toBe('Elige un Núcleo para «Golpe Rápido»');
  });
});

describe('TargetingPromptBanner', () => {
  it('prompt.kind === NONE: no renderiza nada', () => {
    const { container } = render(
      <TargetingPromptBanner prompt={{ kind: 'NONE' }} onCancel={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('prompt distinto de NONE: renderiza el label correspondiente y un botón Cancelar que llama a onCancel', () => {
    const onCancel = vi.fn();
    render(
      <TargetingPromptBanner
        prompt={{ kind: 'AWAITING_ATTACK_TARGET', cardName: 'Golpe Certero', validTargetIds: [] }}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Elige un objetivo para «Golpe Certero»')).toBeInTheDocument();
    screen.getByText('✕ Cancelar').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
