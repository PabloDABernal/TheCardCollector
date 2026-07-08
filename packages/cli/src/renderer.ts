import type { CombatStateSnapshot, CombatEvent, CombatCommandError } from '@collector/domain-combat';
import {
  LEADER_SHIELD_MAX,
  LEADER_ENERGY_MAX,
  LEADER_LEVEL_UPS_MAX,
  UMBRAL_BONUS_THRESHOLD,
} from '@collector/domain-combat';
import type { NameLookup } from './name-lookup';

export interface RenderContext {
  readonly nameLookup: NameLookup;
  readonly leaderMaxHealth: number;
  readonly enemyMaxHealth: number;
  readonly scenarioPlotDefeatThreshold: number;
}

const SEPARATOR = '='.repeat(70);
const THIN_SEPARATOR = '-'.repeat(70);

/**
 * Devuelve el bloque completo (spec H1.19 §5.2) como un único string multi-línea, sin
 * el prompt final ("> ") — eso lo añade `repl.ts` al pedir la siguiente línea.
 */
export function renderSnapshot(snapshot: CombatStateSnapshot, ctx: RenderContext): string {
  const lines: string[] = [];

  lines.push(SEPARATOR);
  lines.push(`Turno ${snapshot.turn.turnNumber} — ${snapshot.turn.turnOwner === 'LEADER' ? 'LÍDER' : 'ENEMIGO'}`);
  lines.push('');

  lines.push(
    `Líder    : Daño ${snapshot.leaderDamage}/${ctx.leaderMaxHealth} | Escudo ${snapshot.leaderShield}/${LEADER_SHIELD_MAX} | Energía ${snapshot.leaderEnergy}/${LEADER_ENERGY_MAX} | Nivel ${snapshot.leaderState.level} (level-ups ${snapshot.leaderState.levelUpsSpent}/${LEADER_LEVEL_UPS_MAX})`
  );
  lines.push(
    `Enemigo  : Daño ${snapshot.enemyDamage}/${ctx.enemyMaxHealth} | ${renderPhase(snapshot.enemyPhase)}`
  );
  lines.push(
    `Escenario: Trama ${snapshot.scenarioPlot} (derrota en ${ctx.scenarioPlotDefeatThreshold}) | ${renderPhase(snapshot.scenarioPhase)}`
  );
  lines.push('');

  lines.push('Núcleos disponibles:');
  lines.push(...renderNucleoPool(snapshot));
  lines.push('');

  lines.push('Cooldowns del Líder:');
  lines.push(...renderCooldowns(snapshot, 'LEADER', ctx));
  lines.push('');
  lines.push('Cooldowns del Enemigo:');
  lines.push(...renderCooldowns(snapshot, 'ENEMY', ctx));
  lines.push('');

  lines.push(
    `Acciones: ${snapshot.actions.actionsTaken}/${snapshot.actions.actionsAllowed} usadas (combo ${snapshot.actions.comboBonusGranted ? 'concedido' : 'no concedido'} este turno)`
  );
  lines.push('');

  lines.push('Aliados en mesa:');
  lines.push(...renderAllies(snapshot, ctx));
  lines.push(renderRedirect(snapshot));
  lines.push('');

  lines.push(renderContratiempo(snapshot));
  lines.push('');

  lines.push(`Estado: ${snapshot.status === 'IN_PROGRESS' ? 'EN CURSO' : snapshot.status}`);
  lines.push(THIN_SEPARATOR);

  return lines.join('\n');
}

function renderPhase(phase: { readonly phaseNumber: number; readonly totalPhases: number }): string {
  if (phase.totalPhases === 0) return 'Fase — (sin tracking)';
  return `Fase ${phase.phaseNumber}/${phase.totalPhases}`;
}

function renderNucleoPool(snapshot: CombatStateSnapshot): string[] {
  if (snapshot.nucleoTable.length === 0) return ['  (pool vacío)'];

  const entries = snapshot.nucleoTable.map((n, i) => {
    let suffix = '';
    if (n.value >= UMBRAL_BONUS_THRESHOLD) suffix += ' (Umbral)';
    if (n.value === 0) suffix += ' (debuff)';
    return `[${i}] ${n.color} valor=${n.value}${suffix}`;
  });

  const lines: string[] = [];
  for (let i = 0; i < entries.length; i += 3) {
    lines.push('  ' + entries.slice(i, i + 3).join('   '));
  }
  return lines;
}

function renderCooldowns(
  snapshot: CombatStateSnapshot,
  side: 'LEADER' | 'ENEMY',
  ctx: RenderContext
): string[] {
  const filtered = snapshot.cooldowns.filter((c) => c.side === side);
  if (filtered.length === 0) return ['  (ninguna)'];
  return filtered.map((c) => {
    const ready = c.remaining === 0 ? '  LISTA' : '';
    return `  ${c.abilityId} (${ctx.nameLookup.abilityName(c.abilityId)})  CD ${c.remaining}/${c.baseCooldown}${ready}`;
  });
}

function renderAllies(snapshot: CombatStateSnapshot, ctx: RenderContext): string[] {
  if (snapshot.alliesInPlay.length === 0) return ['  ninguno'];
  return snapshot.alliesInPlay.map((a, i) => {
    const dead = a.life === 0 ? ' (muerto)' : '';
    return `  [${i}] ${a.cardId} (${ctx.nameLookup.cardName(a.cardId)})    vida ${a.life}/${a.maxLife}${dead}`;
  });
}

function renderRedirect(snapshot: CombatStateSnapshot): string {
  if (snapshot.activeDamageRedirectTargetId === null) {
    return 'Redirección de daño activa: ninguna';
  }
  const index = snapshot.alliesInPlay.findIndex((a) => a.instanceId === snapshot.activeDamageRedirectTargetId);
  const ally = snapshot.alliesInPlay[index];
  return `Redirección de daño activa: [${index}] ${ally ? ally.cardId : snapshot.activeDamageRedirectTargetId}`;
}

function renderContratiempo(snapshot: CombatStateSnapshot): string {
  const count = snapshot.undoableLastEnemyTurn.length;
  if (count === 0) {
    return 'Contratiempo disponible (turno de Enemigo anterior): ninguno (sin turno de Enemigo revertible ahora mismo)';
  }
  return `Contratiempo disponible (turno de Enemigo anterior): ${count} entradas revertibles`;
}

/** Ver spec §5.4 — una línea por `CombatEvent`, con un `default` genérico para
 *  cualquier tipo no cubierto explícitamente. */
export function renderEvent(event: CombatEvent, nameLookup: NameLookup): string {
  switch (event.type) {
    case 'ABILITY_ACTIVATED': {
      const name = event.abilityId ? nameLookup.abilityName(event.abilityId) : event.sourceId;
      const sideLabel = event.side === 'ENEMY' ? ' (Enemigo)' : '';
      return `» ABILITY_ACTIVATED: ${name} (Núcleo ${event.nucleoSpent.color}=${event.nucleoSpent.value})${sideLabel}`;
    }
    case 'TURN_ENDED':
      return `» TURN_ENDED: ${event.previousTurnOwner} → ${event.nextTurnOwner}`;
    case 'COOLDOWNS_TICKED':
      return `» COOLDOWNS_TICKED: ${event.side}`;
    case 'LEADER_DAMAGED':
      return `» LEADER_DAMAGED: ${event.rawAmount} de daño (${event.absorbedByShield} absorbido por Escudo, ${event.appliedDamage} aplicado) — Líder ${event.leaderDamageAfter}`;
    case 'SCENARIO_PLOT_CHANGED':
      return `» SCENARIO_PLOT_CHANGED: ${event.direction} ${event.rawAmount} — Trama ${event.scenarioPlotAfter}`;
    case 'COMBO_TRIGGERED':
      return `» COMBO_TRIGGERED: ${nameLookup.abilityName(event.abilityId)} (acciones permitidas ahora: ${event.actionsAllowedThisTurn})`;
    case 'CONTRATIEMPO_PLAYED':
      return `» CONTRATIEMPO_PLAYED: ${nameLookup.cardName(event.cardId)} (${event.revertedEntries.length} entradas revertidas)`;
    case 'ALLY_ENTERED_PLAY':
      return `» ALLY_ENTERED_PLAY: ${nameLookup.cardName(event.cardId)} (vida ${event.maxLife})`;
    case 'ALLY_DAMAGED':
      return `» ALLY_DAMAGED: ${event.rawAmount} de daño a Aliado ${event.allyInstanceId} (${event.allyLifeAfter} vida restante${event.allyDied ? ', MUERTO' : ''})`;
    case 'DAMAGE_REDIRECT_SET': {
      const warning = event.forcedByBerserker
        ? ' (AVISO: hay un Berserker vivo en mesa, todo el daño irá a él en su lugar)'
        : '';
      return `» DAMAGE_REDIRECT_SET: objetivo ${event.targetAllyInstanceId ?? 'ninguno'}${warning}`;
    }
    case 'MINION_SUMMONED':
      return `» MINION_SUMMONED: ${event.minionDefinitionId} (${event.instanceId})`;
    case 'MINION_ACTION_RESOLVED':
      return `» MINION_ACTION_RESOLVED: ${event.instanceId} (${event.mechanism})`;
    case 'MINION_ACTION_SKIPPED':
      return `» MINION_ACTION_SKIPPED: ${event.reason}`;
    case 'MINION_PASSIVE_EFFECTS_APPLIED':
      return `» MINION_PASSIVE_EFFECTS_APPLIED: ataque=${event.attackAmount} trama=${event.plotAmount}`;
    case 'PHASE_CHANGED':
      return `» PHASE_CHANGED: ${event.source} fase ${event.fromPhaseNumber} → ${event.toPhaseNumber}`;
    case 'LEADER_LEVELED_UP':
      return `» LEADER_LEVELED_UP: nivel ${event.levelAfter} (disparado por ${event.triggeredBy})`;
    case 'CARD_PLAYED':
      return `» CARD_PLAYED: ${nameLookup.cardName(event.cardId)}`;
    case 'ENEMY_DAMAGED':
      return `» ENEMY_DAMAGED: ${nameLookup.cardName(event.cardId)} inflige ${event.rawAmount} de daño al Enemigo (${event.enemyDamageAfter})`;
    case 'LEADER_SHIELD_GAINED':
      return `» LEADER_SHIELD_GAINED: +${event.rawAmount} Escudo (${event.leaderShieldAfter}/${LEADER_SHIELD_MAX})`;
    case 'DRAMATURGIA_CARD_DRAWN':
      return `» DRAMATURGIA_CARD_DRAWN: ${event.icon}`;
    case 'DRAMATURGIA_DECK_RESHUFFLED':
      return `» DRAMATURGIA_DECK_RESHUFFLED: ${event.deckSize} cartas`;
    case 'NUCLEO_TABLE_REROLLED':
      return '» NUCLEO_TABLE_REROLLED';
    case 'COMBAT_ENDED':
      return `» COMBAT_ENDED: ${event.outcome}${event.defeatReason ? ` (${event.defeatReason})` : ''}`;
    default:
      return `» ${(event as CombatEvent).type}`;
  }
}

/** Ver spec §5.5. */
export function renderRejection(error: CombatCommandError): string {
  const fields = Object.entries(error)
    .filter(([k]) => k !== 'code')
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(', ');
  return `✗ Comando rechazado: ${error.code}${fields ? ` (${fields})` : ''}`;
}

/** Ver spec §5.6. */
export function renderFinalBanner(snapshot: CombatStateSnapshot): string {
  const lines: string[] = [SEPARATOR];
  if (snapshot.status === 'VICTORY') {
    lines.push('  COMBATE TERMINADO — VICTORIA');
  } else {
    lines.push(`  COMBATE TERMINADO — DERROTA (${snapshot.defeatReason ?? '???'})`);
  }
  lines.push(SEPARATOR);
  return lines.join('\n');
}
