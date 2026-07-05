# Backlog

## Ideas

## Épicas

### E1: Motor de combate base

Motor de reglas puro (sin Phaser ni React) que implementa la lógica del GDD (Núcleos, cooldowns, Umbral, Trama, IA enemigo, Combo, Contratiempo, Level-Up, Aliados, Secuaces). Incluye contenido de juguete 2×2×2 y test suite que valida todas las mecánicas de forma aislada. Es la base sobre la que se monta Phaser y React en hitos posteriores.

---

## Historias

### H1.1: Setup del monorepo y tooling de base

**Descripción:** establecer la estructura de `packages/domain/shared`, `packages/domain/combat`, `packages/domain/catalog`, `packages/data`; configurar build, test runner (Node + TS), linting y tipos base compartidos según `docs/architecture_stack.md` §1-2.

**Criterio de aceptación:**
- Estructura de carpetas creada y compilable sin errores.
- `packages/domain/shared` contiene tipos base (entidades, IDs, resultados, event bus genérico).
- Test runner (ej. Jest, Vitest) configurado y ejecutable; test dummy pasa.
- `tsconfig` correctamente separado por workspace (sin `react` ni `phaser` en `domain/*`).

**Referencia:** `docs/architecture_stack.md` §1, §7.1.

---

### H1.2: RandomSource inyectable (RNG determinista)

**Descripción:** implementar interfaz `RandomSource` en `packages/domain/shared` que permite inyectar RNG fijo en tests (semilla). Usar esta interfaz en todas las operaciones aleatorias del motor (sorteo de pool de Núcleos, selección de secuaces, IA enemigo, etc.).

**Criterio de aceptación:**
- `RandomSource` interfaz definida.
- Implementaciones: `DefaultRandomSource` (Math.random) e `SeededRandomSource` (determinista con semilla).
- Al menos un test unitario muestra reproducibilidad con semilla fija.

**Referencia:** `docs/architecture_stack.md` §2.4 (testabilidad).

---

### H1.3: Motor de turnos y Núcleos

**Descripción:** implementar en `packages/domain/combat` el sistema de turnos alternos (jugador ↔ enemigo), generación del pool de Núcleos (5 colores base + Neutro, valores 1-4), gasto de Núcleo al pagar una habilidad, y relanzamiento automático cuando se agota el pool. Incluir regla GDD §2.3: "quien tenga turno inmediatamente después del vaciado elige primero".

**Criterio de aceptación:**
- `CombatEngine` crea y gestiona el pool de Núcleos correctamente.
- Al gastar un Núcleo (`ABILITY_ACTIVATED` event), se valida que existe y se elimina del pool.
- Pool se relanza automáticamente cuando no quedan Núcleos; el próximo turno respeta "elige primero quien tenga turno después del vaciado".
- Tests cubren ciclos normales + casos de borde (pool vacío con múltiples jugadores esperando acción).

**Referencia:** GDD §2.3, `docs/architecture_stack.md` §2.2 (interfaces `CombatCommand`, `CombatEvent`).

---

### H1.4: Cooldowns (por vuelta, no por acción)

**Descripción:** cada habilidad (Líder, Aliado, Enemigo) tiene un CD que **baja 1 por vuelta completa** (cuando vuelve a tocar actuar), no por acción individual. CD mínimo = 1 (nunca 0). Líder siempre tiene CD1 ⚫ disponible.

**Criterio de aceptación:**
- `CombatEngine` rastrea CD de cada habilidad.
- CD baja exactamente 1 al iniciar el turno (propio o enemigo).
- Validación: habilidad con CD > 0 no puede ser activada.
- Test: secuencia de turnos muestra descuento correcto (no por acción sino por ciclo de turnos).
- Líder CD1 siempre ⚫ sin modificadores (GDD §2.5).

**Referencia:** GDD §2.5, decisions.md "Cooldown baja 1 por vuelta completa".

---

### H1.5: Umbral (fórmula alimentada por valor de Núcleo 1-4)

**Descripción:** implementar keyword Umbral (GDD §12). El valor del Núcleo gastado (1-4) se usa en fórmulas de daño/efecto (Ataque +X, Ataque ×X, Trama X, etc.). Si el valor es ≥3, se activa un efecto adicional (bonus Umbral). Nunca condiciona si la habilidad es pagable (eso lo decide solo el color/tipo).

**Criterio de aceptación:**
- Keyword Umbral se resuelve correctamente en habilidades (Ataque +valor, Ataque ×valor, etc.).
- Bonus Umbral (≥3) se activa correctamente.
- Validación: Núcleo valor 1 no bloquea una habilidad, solo reduce su efecto.
- Tests parametrizados con valores 1-4 muestran escalado correcto.

**Referencia:** GDD §2.4, §12 (keywords), decisions.md "Costes de habilidad solo por color/genérico".

---

### H1.6: Trama y daño como sistemas separados

**Descripción:** implementar que Trama pertenece al Escenario (no al Enemigo) y es un contador bidireccional. El daño pertenece al Líder. Enemigo tiene habilidades separadas de Ataque (⚔️ → daño) y Trama (📜 → mueve contador). Daño es absorbible por Aliados/escudos; Trama no.

**Criterio de aceptación:**
- `CombatStateSnapshot` separa `leaderDamage` de `scenarioPlot`.
- Habilidad Ataque del Enemigo solo afecta `leaderDamage`.
- Habilidad Trama del Enemigo solo afecta `scenarioPlot`.
- Una habilidad nunca hace ambas cosas.
- Tests muestran que Aliado bloquea daño pero no Trama.

**Referencia:** GDD §3.6, §3.4, decisions.md "Trama la recibe el Escenario; daño lo recibe el Líder".

---

### H1.7: IA del enemigo con prioridades por defecto

**Descripción:** implementar la lógica de IA del Enemigo (GDD §3.5): cuando el Enemigo actúa, elige una carta de Dramaturgia (⚔️ o 📜), valida si tiene Núcleo/CD, ejecuta la habilidad correspondiente según las prioridades (firma > básica). En la capa 2, elige qué Núcleo gastar priorizando valores altos del jugador y estrategia defensiva.

**Criterio de aceptación:**
- `CombatEngine` implementa decisión IA (qué habilidad de Dramaturgia, qué Núcleo).
- Prioridades match GDD §3.5 (Ataque: firma > básica; Trama: max-CD > básica; Núcleo: nega alto > mayor valor).
- Tests parametrizados muestran IA responde correctamente a estado de tablero (CD cambios, valores de Núcleo disponibles).

**Referencia:** GDD §3.5, `docs/architecture_stack.md` §2.2 (interfaces de dominio).

---

### H1.8: CatalogLoader + tipos de datos base

**Descripción:** implementar en `packages/domain/catalog` las interfaces `CardDefinition`, `LeaderDefinition`, `EnemyDefinition`, `ScenarioDefinition`, `EvolutionTemplate` según `docs/architecture_stack.md` §5. Implementar `CatalogLoader` que valida esquema JSON y resuelve referencias cruzadas.

**Criterio de aceptación:**
- Tipos definidos (interfaces/types en TS).
- `CatalogLoader` lee JSON y valida contra esquema (ej. zod).
- Accessor methods: `getCard()`, `getLeader()`, `getEnemy()`, `getScenario()`, `getEvolutionTemplate()`.
- Validación falla con mensaje claro si faltan campos o referencias cruzadas rotas.

**Referencia:** `docs/architecture_stack.md` §5, architecture_stack.md §7.2-7.3 (pasos del Programmer).

---

### H1.9: Contenido de juguete — Líderes (2)

**Descripción:** crear 2 Líderes de prueba en JSON (`packages/data/leaders/`) con definiciones completas (4 habilidades base con CD 1-4, pool de 10 cartas propias, Level-Up options). Nombres/temática simple (ej. "Soldado base", "Mago base") para usar como prueba del generalizador.

**Criterio de aceptación:**
- 2 `LeaderDefinition` válidas en formato JSON.
- `CatalogLoader` puede cargarlas sin errores.
- Cada una tiene las 4 habilidades base, CD1 siempre ⚫.
- Pool de 10 cartas propias resuelve correctamente contra `CardDefinition`.

**Referencia:** GDD §4.1, `docs/architecture_stack.md` §5.1-5.2.

---

### H1.10: Contenido de juguete — Enemigos (2)

**Descripción:** crear 2 Enemigos de prueba en JSON (`packages/data/enemies/`) con definiciones de habilidades Ataque/Trama separadas, al menos 1 fase, y un deck de Dramaturgia mínimo que valide la IA.

**Criterio de aceptación:**
- 2 `EnemyDefinition` válidas en formato JSON.
- Cada una tiene habilidades Ataque ⚔️ y Trama 📜 separadas.
- CD1 doble: 1 Ataque básico y 1 Trama básico, ambos ⚫.
- Dramaturgia mínima cargable y ejecutable en IA.

**Referencia:** GDD §5.2, GDD §3.4-3.5, `docs/architecture_stack.md` §5.

---

### H1.11: Contenido de juguete — Escenarios (2)

**Descripción:** crear 2 Escenarios de prueba en JSON (`packages/data/scenarios/`) con definiciones de Trama (contador, umbrales de efectos), deck de Dramaturgia mínimo (cartas de Escenario + comunes).

**Criterio de aceptación:**
- 2 `ScenarioDefinition` válidas en formato JSON.
- Cada una define Trama con umbrales escalonados (ej. +1 a 5 efectos de escalada).
- Dramaturgia cargable y jugable con combate (junto a Enemigos).

**Referencia:** GDD §5.1, GDD §3.6, `docs/architecture_stack.md` §5.

---

### H1.12: Contenido de juguete — Cartas base

**Descripción:** crear un pequeño catálogo de cartas (`packages/data/cards/`) suficiente para que los 2 Líderes tengan sus pools de 10 + que se pueda jugar combates (Ataques simples, Equipo, Aliados básicos, Contraatiempos). ~20 cartas total.

**Criterio de aceptación:**
- `CardDefinition[]` tipadas y válidas, cubren tipos (Evento, Equipo, Aliado, Contratiempo).
- Keywords básicos (Ataque +X, Defensa X, Trama X, Umbral, Arrollar) instanciados correctamente.
- Las 10 cartas propias de cada Líder resuelven correctamente contra este catálogo.

**Referencia:** GDD §4.2-4.3, GDD §3.3, `docs/architecture_stack.md` §5.

---

### H1.13: Tests unitarios del motor (Núcleos, cooldowns, Umbral, Trama, IA)

**Descripción:** escribir test suite que cubra todas las mecánicas del GDD §2-3 sin Phaser ni React. Usar `RandomSource` inyectable para reproducibilidad. Tests deben ser parametrizados y abarcar casos normales + borde.

**Criterio de aceptación:**
- Cobertura ≥80% de `packages/domain/combat`.
- Tests cubren: turnos, Núcleos, cooldowns, Umbral, Trama, IA, Combo, Contratiempo, Aliados, Secuaces, Escudos.
- Casos de borde: CD bloqueado, pool vacío, Umbral no activado, Trama en umbral, daño > escudo + Arrollar, etc.
- Todos los tests pasan en Node puro (sin Phaser, sin DOM).

**Referencia:** `docs/architecture_stack.md` §2.4 (testabilidad).

---

### H1.14: Combo y Contratiempo — lógica de motor

**Descripción:** implementar keywords Combo (permite 3ª acción si la anterior generó Combo) y Contratiempo (carta que deshace el turno enemigo anterior sin restaurar Núcleos). Validar que no se repite habilidad en cadena Combo.

**Criterio de aceptación:**
- Habilidad con Combo genera evento `COMBO_TRIGGERED` permitiendo 3ª acción.
- Contratiempo: validación de costa Energía, deshace efectos del turno anterior, no restaura pool Núcleos.
- Tests muestran repetición de habilidad en Combo rechazada.

**Referencia:** GDD §2.6-2.7.

---

### H1.15: Aliados y absorción de daño

**Descripción:** implementar que Aliados en mesa bloquean daño inmediatamente (sin calentamiento), que daño puede redirigirse a Aliado sin gastar acción, que daño excedente se pierde a menos que tenga Arrollar. Berserker absorbe todo daño obligatoriamente.

**Criterio de aceptación:**
- Aliado entra en mesa sin CD en su bloqueo.
- Redirección de daño a Aliado es validada sin consumir acción.
- Daño 10 a Aliado con 5 vida: Aliado muere, exceso se pierde (sin Arrollar).
- Daño 10 con Arrollar: Aliado muere (5), Líder recibe 5.
- Berserker fuerza toda absorción hacia él.

**Referencia:** GDD §3.7, §3.3.

---

### H1.16: Secuaces del enemigo (presencia pasiva, acción selectiva)

**Descripción:** implementar que Secuaces aportan efecto pasivo mientras están en mesa, solo 1 actúa por turno enemigo (selección aleatoria con filtro de validez), Defensor fuerza ser atacado primero.

**Criterio de aceptación:**
- Secuaz entra en mesa con efecto pasivo declarado.
- Efecto pasivo es leído por `CombatEngine` cada turno del enemigo.
- Selección de Secuaz que actúa: uno al azar entre los válidos (no CD, Núcleo disponible).
- Keyword Defensor: Secuaz es atacado primero o si ya está en mesa no se puede ignorar.

**Referencia:** GDD §3.8.

---

### H1.17: Level-Up del Líder (contador único por run)

**Descripción:** implementar que Líder gana nivel-ups por triggers dentro del combate (según GDD §6.1.bis, no especificado aún en GDD v2 pero citado) o automáticamente en descanso (H1.18 futuro). Un único contador por run con tope de 2 subidas (3 niveles totales: 1 base + 2).

**Criterio de aceptación:**
- `LeaderState` contiene `level` (1-3) y `levelUpsSpent` (0-2).
- Level-Up eleva `level`, `levelUpsSpent` aumenta.
- Al alcanzar nivel 3, no se puede subir más (validación).
- El efecto del Level-Up (parámetros) se resuelve desde `LeaderDefinition.levelUpOptions`.

**Referencia:** GDD §4.3, GDD §7.3, decisions.md "Level-Up del Líder: un único contador por run".

---

### H1.18: Sistema básico de juego de combate (turn loop integrado)

**Descripción:** integrar todos los sistemas anteriores en un loop de combate funcional: inicializar combate (Líder, Enemigo, Escenario, Dramaturgia), turnos alternos, despacho de acciones, resolución de eventos, chequeo de condición de victoria/derrota.

**Criterio de aceptación:**
- `CombatEngine.dispatch(command)` procesa acciones del jugador correctamente.
- Turno enemigo (IA) ocurre automáticamente tras `END_TURN` del jugador.
- Condiciones de derrota: vida Líder ≤0 o Trama ≥ umbral final.
- Condición de victoria: vida Enemigo ≤0.
- `CombatStateSnapshot` refleja estado después de cada comando.

**Referencia:** `docs/architecture_stack.md` §2.2-2.3.

---

### H1.19: Test harness CLI para jugar combate aislado

**Descripción:** crear un script/CLI simple (ej. `npm run play-combat`) que permite jugar un combate completo contra IA sin Phaser ni React: cargar contenido 2×2×2, iniciar combate, despachar acciones vía stdin, ver salida en consola.

**Criterio de aceptación:**
- Script levanta combate con 1 Líder vs 1 Enemigo + Escenario.
- Input: comandos textuales (ej. `play card X`, `activate ability Y`, `end turn`).
- Output: estado de combate legible (vida, Núcleos, CD, Trama, acciones disponibles).
- Se puede jugar hasta victoria/derrota sin errores.

**Referencia:** Validación manual del motor antes de montar Phaser.

---

## Bugs
