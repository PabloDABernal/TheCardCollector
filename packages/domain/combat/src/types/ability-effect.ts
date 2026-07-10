import type { AbilityUmbralDefinition } from './umbral';

/**
 * Tope global de fichas de Escudo del Líder — GDD §2.8: "Tope global de escudo del
 * Líder: 5 (punto de partida)". El propio GDD lo marca como "punto de partida"
 * (posible ajuste de contenido/balance futuro, no una ley física) — se modela como
 * constante de esta historia, igual de "no definitivo" que `DEFAULT_NUCLEO_POOL_SIZE`
 * (nucleo-pool.ts, H1.3 §0.3). Ver spec H1.6 §0.1.
 */
export const LEADER_SHIELD_MAX = 5;

/**
 * Dato de una habilidad relevante para H1.6: qué mecanismo del combate muta y con qué
 * magnitud. Cada `abilityId` mapea a UNA sola variante de esta unión — nunca a las dos
 * a la vez (garantía de tipos, no solo de test; ver spec H1.6 §0.2, criterio "una
 * habilidad nunca hace ambas cosas"). Resuelto externamente e inyectado en
 * `CombatEngineConfig.abilityEffects` (§2.2), igual patrón que `abilityCoreCosts`
 * (H1.3) y `abilityCooldowns` (H1.4) — `CatalogLoader` (H1.8) no existe todavía.
 *
 * - `ATTACK` — Ataque (GDD §3.4, icono ⚔️). Daño = `resolveAbilityUmbral` (H1.5)
 *   aplicado a `formula` con el valor del Núcleo gastado (GDD §12: "Ataque"/"Ataque
 *   +X"/"Ataque ×X" están alimentadas por Núcleo). MODIFICADO H4.x — ya NO está
 *   restringido a habilidades cuyo `AbilityCooldownDefinition.side` sea `'ENEMY'`: una
 *   habilidad `ATTACK` del `LEADER` golpea al Enemigo/Secuaz (vía `AttackTarget`, mismo
 *   flujo de targeting que `PLAY_CARD`/`ATTACK_ENEMY`), nunca al propio Líder/Aliado —
 *   ver spec H4_targeting_habilidades_y_ficha_personaje.md §1. Una `ATTACK` del `ENEMY`
 *   sigue golpeando Líder/Aliado sin cambios (`resolveDamageTarget()`).
 *   `arrollar`: si NO había ningún escudo activo en el momento del golpe
 *   (`leaderShield === 0`), el daño pasa completo sin necesidad de esta keyword — no
 *   hay nada que "arrollar". Si SÍ había escudo y no bastó para absorberlo todo, el
 *   exceso solo pasa a `leaderDamage` cuando `arrollar` es `true`; si es `false`/ausente
 *   (default), ese exceso se pierde (GDD §2.8, keyword Arrollar).
 * - `PLOT` — Trama (GDD §3.6, icono 📜). Magnitud FIJA `amount` (siempre >= 0),
 *   deliberadamente NO alimentada por el valor del Núcleo — ver spec §0.3 para la
 *   justificación completa de por qué esto NO reutiliza `AbilityUmbralDefinition`. La
 *   dirección (sube/baja) la decide el `side` dueño de la habilidad en tiempo de
 *   aplicación (§0.4), no un campo de esta interfaz: `side: 'ENEMY'` → sube,
 *   `side: 'LEADER'` → baja (GDD §12: "Enemigo sube, jugador baja").
 */
export type AbilityEffectDefinition =
  | { readonly kind: 'ATTACK'; readonly formula: AbilityUmbralDefinition; readonly arrollar?: boolean }
  | { readonly kind: 'PLOT'; readonly amount: number };
