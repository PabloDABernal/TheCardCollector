import type { CombatStateSnapshot, NucleoDie } from '@collector/domain-combat';
import { satisfiesCoreCost } from '@collector/domain-shared';
import type { AbilityViewData } from '../view';

/**
 * FIX Reviewer (post-H3, commit `cce72a3`) — extraído de `handleAbilityTap`
 * (`gesture-command-translator.ts`) para que `CombatHud.tsx` (`apps/shell`) pueda calcular la
 * MISMA disponibilidad "por color real" en vez de un agregado laxo. Pura, sin estado: filtra
 * `nucleoTable` a los dados `AVAILABLE` cuyo color satisface `coreCost` (`satisfiesCoreCost`,
 * `@collector/domain-shared`) — mismo criterio que el motor usaría al validar `ACTIVATE_ABILITY`.
 */
export function findValidDiceForAbility(
  nucleoTable: readonly NucleoDie[],
  coreCost: AbilityViewData['coreCost'],
): readonly NucleoDie[] {
  return nucleoTable.filter((die) => die.status === 'AVAILABLE' && satisfiesCoreCost(coreCost, die.color));
}

/**
 * FIX Reviewer — disponibilidad AGREGADA de "¿hay alguna habilidad del Líder activable ahora
 * mismo?", para el indicador "Activar Habilidad" del HUD (`CombatHud.tsx`). Antes del fix, el HUD
 * comprobaba por separado "¿algún dado libre?" y "¿alguna habilidad en CD 0?" sin cruzar color
 * contra `coreCost` de la habilidad concreta — divergía de la validación real que
 * `gesture-command-translator.ts` sí hacía al tocar el icono. Aquí: por cada `AbilityCooldownSnapshot`
 * del lado LEADER con `remaining === 0`, busca la `AbilityViewData` correspondiente (por
 * `abilityId`) y comprueba si `findValidDiceForAbility` devuelve al menos un dado — si ninguna
 * habilidad lista tiene un dado de color válido disponible, el resultado es `false`.
 */
export function isAnyLeaderAbilityActivatable(
  snapshot: CombatStateSnapshot,
  leaderAbilities: readonly AbilityViewData[],
): boolean {
  const abilitiesById = new Map(leaderAbilities.map((ability) => [ability.abilityId, ability]));

  return snapshot.cooldowns.some((cooldown) => {
    if (cooldown.side !== 'LEADER' || cooldown.remaining !== 0) return false;
    const ability = abilitiesById.get(cooldown.abilityId);
    if (!ability) return false; // no debería pasar en producción (mismo catálogo); defensivo
    return findValidDiceForAbility(snapshot.nucleoTable, ability.coreCost).length > 0;
  });
}
