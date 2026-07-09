import type { TargetingPrompt } from '@collector/combat-scene';
import { chipStyle } from '../CombatHud';
import { COLOR_FOIL, COLOR_TEXT_PRIMARY, SPACING, TYPE } from '../../ui/design-tokens';

export interface TargetingPromptBannerProps {
  readonly prompt: TargetingPrompt;
  readonly onCancel: () => void;
}

/** H4_componente_carta.md §5.3 — banner "Elige un objetivo"/"Elige un Núcleo", montado dentro del
 *  contenedor flex-column que ya envuelve `CombatHud` (mismo `sticky` que la spec sugiere como
 *  alternativa simple al cálculo manual de altura de `CombatHud`, cuya altura es variable por
 *  `flex-wrap`). `null` cuando `prompt.kind === 'NONE'` — nunca se pinta un banner vacío. */
export function TargetingPromptBanner({ prompt, onCancel }: TargetingPromptBannerProps): JSX.Element | null {
  if (prompt.kind === 'NONE') return null;
  const label = promptLabelFor(prompt);

  return (
    <div
      className="targeting-prompt-banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(212, 162, 76, 0.16)',
        borderBottom: `2px solid ${COLOR_FOIL}`,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        animation: 'foil-pulse-bg 1.6s ease-in-out infinite',
      }}
    >
      <span style={{ ...TYPE.bodyMd, fontWeight: 700, color: COLOR_TEXT_PRIMARY }}>{label}</span>
      <button onClick={onCancel} style={{ ...chipStyle(true), background: 'transparent' }}>
        ✕ Cancelar
      </button>
    </div>
  );
}

/** Helper puro — testeable en aislamiento. */
export function promptLabelFor(prompt: Exclude<TargetingPrompt, { kind: 'NONE' }>): string {
  switch (prompt.kind) {
    case 'AWAITING_ATTACK_TARGET':
      return `Elige un objetivo para «${prompt.cardName}»`;
    case 'AWAITING_NUCLEO_FOR_CARD':
      return `Elige un Núcleo para «${prompt.cardName}»`;
    case 'AWAITING_NUCLEO_FOR_ABILITY':
      return `Elige un Núcleo para «${prompt.abilityName}»`;
    default:
      return '';
  }
}
