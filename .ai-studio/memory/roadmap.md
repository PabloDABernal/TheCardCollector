# Roadmap

Solo contiene grandes hitos.

Nunca tareas.

---

## Hitos

### H1: Motor de combate jugable de forma aislada (sin UI) con contenido de prueba 2×2×2

**Objetivo:** validar que el motor de reglas (Núcleos, cooldowns, Umbral, Trama, IA enemigo, cooldowns, combos, Contratiempo) es correcto, generalizable y testeable sin Phaser ni React. Incluye contenido de prueba mínimo (2 Líderes, 2 Enemigos, 2 Escenarios) que permite iterar balance sin recompilar.

**Alcance:**
- `packages/domain/shared`: tipos base, `RandomSource` inyectable.
- `packages/domain/combat`: motor de turnos, Núcleos, cooldowns, Umbral, Trama, IA enemigo, Combo, Contratiempo.
- `packages/domain/catalog`: `CatalogLoader` + tipos (`CardDefinition`, `LeaderDefinition`, `EnemyDefinition`, `ScenarioDefinition`, `EvolutionTemplate`).
- Contenido de juguete: 2 Líderes, 2 Enemigos, 2 Escenarios (suficiente para validar que el modelo generaliza).
- Test suite cubriendo reglas mecánicas sin Phaser ni React.

**Criterio de éxito:**
- Motor pasa tests de todas las mecánicas del GDD §2-3 (Núcleos, cooldowns, Umbral, Trama, IA, Combo, Contratiempo).
- Se puede jugar un combate completo contra IA de forma aislada (CLI o test harness).
- Contenido 2×2×2 valida que tipos de datos generalizan sin excepciones hardcodeadas.

**Próximo hito:** Vertical slice con Phaser (H2) — puente React↔Phaser, EffectsDirector/juice, primer combate visual.