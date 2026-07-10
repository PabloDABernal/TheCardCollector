# Backlog

## Ideas

## Bugs

### B1: `card-mago-base-02` y `card-soldado-base-02` — ruleText menciona escala de dados sin Umbral/NEUTRO — ✅ RESUELTO (Programmer, H4.y)

**Descripción:** Las cartas "Descarga Arcana" (`card-mago-base-02`) y "Golpe Certero" (`card-soldado-base-02`) tienen `ruleText` que promete "escalando con el valor del dado usado" (mecánica de Umbral), pero:
- No llevan keyword `UMBRAL` ni `NEUTRO` en su array de keywords.
- Su coste es `{ "energy": 2 }` (Energía pura), sin declarar coste de Núcleo (que sería requerido para usar la mecánica de Umbral).

Esto crea inconsistencia: el texto promete un efecto que el sistema de costes no puede resolver mecánicamente. Según decisions.md 2026-07-10, cada Líder puede llevar máximo 1-2 cartas con Umbral/NEUTRO; el Mago ya tiene su cuota cubierta por "Vórtice" (`card-mago-base-03` con UMBRAL) y el Soldado por "Estocada" (`card-soldado-base-01` con UMBRAL). Por lo tanto, estas dos cartas deben pasar a ser Energía pura sin mención de dados en su resolución.

**Criterio de aceptación:**
- `card-mago-base-02` ("Descarga Arcana") ruleText reescrito sin mención de dados/Umbral. Sugerencia: "Ataque ×2 de energía pura."
- `card-soldado-base-02` ("Golpe Certero") ruleText reescrito de forma similar. Sugerencia: "Ataque ×2 de energía pura."
- Ambas cartas mantienen su coste `{ "energy": 2 }`.
- NO se añaden keywords `UMBRAL` ni `NEUTRO` (permanecen como Energía pura).
- Cambio aplicado en 6 archivos (2 pairs espejados en paquetes de datos + 2 en shell): `packages/data/cards/mago-base-cards.json`, `packages/data/cards/soldado-base-cards.json`, `packages/combat-scene/public/data/cards/mago-base-cards.json`, `packages/combat-scene/public/data/cards/soldado-base-cards.json`, `apps/shell/public/data/cards/mago-base-cards.json`, `apps/shell/public/data/cards/soldado-base-cards.json`.

**Detectado por:** Game Designer (decisions.md 2026-07-10). Efecto: data integrity, coherencia entre texto de reglas y costes mecánicos del contenido de prueba.

**Prioridad:** Alta (afecta coherencia de reglas y jugabilidad del contenido de juguete).

---

## Épicas

### E1: Motor de combate base

Motor de reglas puro (sin Phaser ni React) que implementa la lógica del GDD (Núcleos, cooldowns, Umbral, Trama, IA enemigo, Combo, Contratiempo, Level-Up, Aliados, Secuaces). Incluye contenido de juguete 2×2×2 y test suite que valida todas las mecánicas de forma aislada. Es la base sobre la que se monta Phaser y React en hitos posteriores.

---

### E2: Vertical slice visual con Phaser — puente React↔Phaser, EffectsDirector, primer combate jugable

Montar la capa visual del combate sobre el motor de dominio (validado en H1). Incluye: setup de `packages/combat-scene` (Phaser), `packages/ui-shared` (componentes React compartidos), `apps/shell` (React + Vite) y el puente de comunicación; implementar `EffectsDirector` con recetas de "juice" (dados rodando, cartas volteando, golpes con impacto, screen shake); un primer combate visual completo: tablero con Núcleos, cartas jugables con cooldowns visuales, daño y Trama visibles, animaciones suave. Al terminar, un jugador puede ver un combate H1 ejecutándose con la riqueza visual pedida (referencias forcetable.net/strawtable.net), no solo texto en CLI.

---

### E3: Cierre del ciclo jugable de combate — cableado de input, Generar Energía, ajuste de pool

Conectar los últimos piezas que faltan para que el combate sea realmente jugable tras probar el vertical slice de H2 desplegado: permitir que el jugador active habilidades del Líder mediante tap/clic (H2.7 lo dejó fuera deliberadamente), implementar la acción "Generar Energía" como decisión explícita de ritmo (consumiendo 1 acción, sin regeneración automática), y ajustar el pool de Núcleos a 8 fichas para mejorar la varianza de color. Incluye UI visual que comunique claras decisiones disponibles en cada turno. Todos los cambios son cierre de mecánicas ya cerradas de diseño, sin contenido nuevo ni expansión de scope.

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

⚠️ **Reabierta 2026-07-08:** La descripción y criterios de aceptación asumen un modelo de pool de fichas homogéneo que se vacía por completo. Este modelo ha sido reemplazado por uno nuevo (ver decisions.md 2026-07-08): 5 dados fijos en mesa (uno por color), con valor 1-4 independiente al tirarse; cartas/equipo pueden añadir dados EXTRA de color específico; tope duro de dados en mesa (sugerido 10); reroll ocurre cuando se gasta el ÚLTIMO dado disponible (todos se re-tiran a la vez). Esta historia debe revisarse ANTES de que Architect diseñe el nuevo modelo en H3.4.

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

### H1.5: Umbral (fórmula alimentada por valor de Núcleo 1-4, incluye debuff a 0)

**Descripción:** implementar keyword Umbral (GDD §12). El valor del Núcleo gastado (1-4, pero modificable a 0 por debuff — ver decisions.md "Piso del valor de Núcleo") se usa en fórmulas de daño/efecto (Ataque +X, Ataque ×X, Trama X, etc.). Si el valor es ≥3, se activa un efecto adicional (bonus Umbral). Nunca condiciona si la habilidad es pagable (eso lo decide solo el color/tipo) — un Núcleo a 0 sigue siendo válido para pagar el coste, solo resuelve el efecto numérico en 0.

**Criterio de aceptación:**
- Keyword Umbral se resuelve correctamente en habilidades (Ataque +valor, Ataque ×valor, etc.).
- Bonus Umbral (≥3) se activa correctamente.
- Validación: Núcleo valor 1 no bloquea una habilidad, solo reduce su efecto.
- Núcleo modificado a 0: la habilidad se ejecuta (consume Núcleo y acción) pero su efecto numérico resuelve a 0; Umbral no se activa (0 < 3).
- Tests parametrizados con valores 0-4 muestran escalado correcto, incluyendo el caso 0.

**Referencia:** GDD §2.4, §12 (keywords), decisions.md "Costes de habilidad solo por color/genérico" y "Piso del valor de Núcleo: permitir 0 como debuff extremo".

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

⚠️ **Reabierta 2026-07-08:** Las interfaces `EnemyDefinition` y `ScenarioDefinition` necesitan un nuevo campo opcional `alternativeVictoryConditions?: VictoryCondition[]` que permita definir reglas de victoria/derrota adicionales o alternativas a las por defecto (vida Líder a 0, Trama a umbral, vida Enemigo a 0). Ejemplos: "Ganador: todos los Secuaces del Enemigo mueren", "Perdedor: el contador de Trama llega a -5". Este campo debe ser validado por el schema de `CatalogLoader`.

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

**Descripción:** crear 2 Enemigos de prueba en JSON (`packages/data/enemies/`) con definiciones de habilidades Ataque/Trama separadas, **2 fases cada uno** (estándar del MVP, ver decisions.md sobre trigger de Level-Up por cambio de fase), y un deck de Dramaturgia mínimo que valide la IA.

**Criterio de aceptación:**
- 2 `EnemyDefinition` válidas en formato JSON.
- Cada una tiene habilidades Ataque ⚔️ y Trama 📜 separadas.
- Cada una define 2 fases con su condición de cambio de fase (evento `PHASE_CHANGED` consumible por H1.17).
- CD1 doble: 1 Ataque básico y 1 Trama básico, ambos ⚫.
- Dramaturgia mínima cargable y ejecutable en IA.

**Referencia:** GDD §5.2, GDD §3.4-3.5, `docs/architecture_stack.md` §5, decisions.md "checkpoint de cambio de fase".

---

### H1.11: Contenido de juguete — Escenarios (2)

**Descripción:** crear 2 Escenarios de prueba en JSON (`packages/data/scenarios/`) con definiciones de Trama (contador, umbrales de efectos), **2 fases cada uno** (ver decisions.md sobre trigger de Level-Up por cambio de fase), deck de Dramaturgia mínimo (cartas de Escenario + comunes).

**Criterio de aceptación:**
- 2 `ScenarioDefinition` válidas en formato JSON.
- Cada una define Trama con umbrales escalonados (ej. +1 a 5 efectos de escalada).
- Cada una define 2 fases con su condición de cambio de fase (evento `PHASE_CHANGED` consumible por H1.17).
- Dramaturgia cargable y jugable con combate (junto a Enemigos).

**Referencia:** GDD §5.1, GDD §3.6, `docs/architecture_stack.md` §5, decisions.md "checkpoint de cambio de fase".

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

⚠️ **Reabierta 2026-07-08:** Los tests de Núcleos asumen el modelo viejo de pool de fichas homogéneo (ver H1.3 reapertura). Los tests deben revisarse ANTES de H3.4 para validar contra el nuevo modelo de 5 dados fijos por color + extras + tope en mesa.

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

### H1.16: Secuaces del enemigo (presencia pasiva, comportamiento dirigido por Dramaturgia)

**Descripción:** implementar que Secuaces aportan efecto pasivo mientras están en mesa, tienen HP propio (definido en catálogo), pueden morir al llegar a 0 de vida, y su acción/comportamiento es dictado por el **efecto textual de la carta de Dramaturgia** del Enemigo (no selección aleatoria del motor). Keyword Defensor sigue forzando prioridad de ataque.

**Criterio de aceptación:**
- Secuaz define su vida máxima como campo fijo en `CardDefinition` (igual que Aliados).
- Secuaz entra en mesa con efecto pasivo declarado; el pasivo es leído por `CombatEngine` cada turno.
- **Comportamiento en Dramaturgia:** la carta de Dramaturgia especifica cómo actúan los Secuaces ese turno vía `minionBehavior` (ver abajo). El motor valida que Secuaces existe y cumple la condición, pero NO elige aleatoriamente.
- Secuaz recibe daño dirigido y pierde vida; al llegar a 0, sale de mesa inmediatamente sin trigger por defecto.
- Exceso de daño que mata un Secuaz: se pierde salvo que el ataque tenga Arrollar (keyword reutilizado de Aliados), en cuyo caso el exceso pasa al Enemigo.
- Keyword Defensor: fuerza que ese Secuaz específico sea atacado primero si está en mesa.
- **Vocabulario de `minionBehavior` en Dramaturgia:** valores soportados: `ALL` (todos actúan), `RANDOM_ONE` (uno al azar entre válidos), `SPECIFIC_DEFINITION` (un Secuaz de una definición concreta), `HIGHEST_PLANO_ATTACK` (el de mayor ataque), **`HIGHEST_LIFE` (el de más vida actual)**, **`LOWEST_LIFE` (el de menos vida actual, típicamente el más cerca de morir)**.

**Referencia:** GDD §3.8, decisions.md 2026-07-08 "Vida de Secuaz" + "Secuaces del Enemigo: comportamiento en Dramaturgia", glossary.md.

⚠️ **Reabierta 2026-07-08:** Completamente rediseñada. La nueva regla es: selección y acción de Secuaces dictada por Dramaturgia (no motor), HP propio del Secuaz permite criterios `HIGHEST_LIFE`/`LOWEST_LIFE`. Refactorizar validación de motor ANTES de H3 para reflejar el nuevo flujo.

---

### H1.17: Level-Up del Líder (contador único por run, trigger de cambio de fase)

**Descripción:** implementar que el Líder gana un Level-Up dentro de combate cada vez que el Enemigo o el Escenario activo cambia de fase (checkpoint de fase, no de vida/Trama — ver decisions.md). El contenido MVP tiene típicamente 2 fases por Enemigo/Escenario; el motor no debe asumir un número fijo de fases, debe leerlo de `EnemyDefinition`/`ScenarioDefinition` para soportar contenido futuro con más fases. Comparte contador único con los Level-Up ganados en descanso (H1.18/GDD §7.3). Tope de 2 subidas (3 niveles totales: 1 base + 2).

**Criterio de aceptación:**
- `LeaderState` contiene `level` (1-3) y `levelUpsSpent` (0-2).
- Evento de cambio de fase de Enemigo o Escenario (`PHASE_CHANGED`) dispara un intento de Level-Up si `levelUpsSpent < 2`.
- Si ya se alcanzó el tope (2 subidas / nivel 3), un cambio de fase adicional no genera Level-Up ni error — simplemente no hace nada.
- El número de fases es un dato de `EnemyDefinition`/`ScenarioDefinition`, nunca una constante hardcodeada en el motor.
- El efecto del Level-Up (parámetros) se resuelve desde `LeaderDefinition.levelUpOptions`.

**Referencia:** GDD §4.3, GDD §7.3, decisions.md "Level-Up del Líder: un único contador por run" y "checkpoint de cambio de fase del Enemigo o del Escenario".

---

### H1.18: Sistema básico de juego de combate (turn loop integrado)

**Descripción:** integrar todos los sistemas anteriores en un loop de combate funcional: inicializar combate (Líder con 1 de Energía inicial — ver decisions.md, Enemigo, Escenario, Dramaturgia), turnos alternos, despacho de acciones, resolución de eventos, chequeo de condición de victoria/derrota. Recordar que por norma las habilidades no cuestan Energía (solo bajar cartas de mano la paga), salvo excepción explícita en una definición concreta.

**Criterio de aceptación:**
- `CombatEngine.dispatch(command)` procesa acciones del jugador correctamente.
- El Líder inicia el combate con 1 de Energía (máximo 5).
- Activar una habilidad (Líder/Aliado/Enemigo) no consume Energía salvo que la propia definición lo declare explícitamente; bajar una carta de mano sí la consume.
- Turno enemigo (IA) ocurre automáticamente tras `END_TURN` del jugador.
- Condiciones de derrota: vida Líder ≤0 o Trama ≥ umbral final.
- Condición de victoria: vida Enemigo ≤0.
- `CombatStateSnapshot` refleja estado después de cada comando.

**Referencia:** `docs/architecture_stack.md` §2.2-2.3, decisions.md "Energía inicial del Líder: 1" y "Coste de Energía de las habilidades".

⚠️ **Reabierta 2026-07-08:** Añadir soporte para condiciones de victoria/derrota alternativas (ver H1.8 reapertura). El chequeo al final de cada turno debe:
- Validar condiciones por defecto (vida Líder ≤0, Trama ≥ umbral, vida Enemigo ≤0).
- Si existen `alternativeVictoryConditions` en la definición del Enemigo/Escenario activo, también evaluarlas (ej. "todos los Secuaces mueren" → victoria, "Trama < -5" → derrota).
- Retornar resultado de combate si cualquier condición se cumple.

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

### H2.1: Setup de packages/combat-scene y packages/ui-shared con tooling Vite + Phaser

**Descripción:** crear la estructura de directorios `packages/combat-scene` (Phaser, sin React) y `packages/ui-shared` (componentes React reutilizables); configurar Vite como bundler, instalar Phaser como dependencia de combat-scene, configurar tsconfig y ESLint boundaries para que combat-scene importe domain pero no al revés.

**Criterio de aceptación:**
- Carpetas `packages/combat-scene/{scenes,juice,input,view}` y `packages/ui-shared/{components}` creadas.
- `packages/combat-scene/package.json` declara Phaser como dependencia; `packages/ui-shared/package.json` declara React.
- ESLint boundaries en `eslint.config.mjs` validando que `combat-scene` importa `domain/*` pero no al revés.
- Ambos packages compilables y pasibles de import desde `apps/shell` sin errores de tipo.

**Referencia:** `docs/architecture_stack.md` §1, §6; `eslint.config.mjs` líneas 20-36 (pattern y rules futuras ya comentadas).

---

### H2.2: Setup de apps/shell (React + Vite) y estructura de pantallas base

**Descripción:** crear el shell React (`apps/shell`) con Vite, estructura de directorios para pantallas (`/screens`), carpeta `combat-bridge` (puente React↔Phaser), carpeta `pwa` (manifest, service worker stub), y un routing mínimo (ej. React Router) con pantalla "Home" stub y pantalla "Combat" que será el mount point de Phaser.

**Criterio de aceptación:**
- App React levanta con `npm run dev` en `apps/shell` sin errores.
- Página Home existe (puede ser vacía o con placeholder).
- Página de Combat aloja un contenedor `<div id="phaser-mount">` donde se montará Phaser.
- `apps/shell/package.json` declara React, Vite y React Router.
- Service worker y manifest son stubs para PWA (no funcionales aún; ver H2.7).

**Referencia:** `docs/architecture_stack.md` §1, §4.1; CLAUDE.md (instrucciones del Director).

---

### H2.3: CombatBridge — pub/sub entre CombatEngine y vistas (React + Phaser)

**Descripción:** implementar en `apps/shell/combat-bridge` la interfaz `CombatBridge` que actúa como intermediaria: recibe commands desde React (via `dispatch(intent)`) y desde Phaser (via `onIntent`), los remite al `CombatEngine`, y publica los eventos retornados a dos canales separados: `subscribeHudEvents` (consumido por React overlay) y `subscribeSceneEvents` (consumido por Phaser/EffectsDirector).

**Criterio de aceptación:**
- Clase `CombatBridge` implementa las interfaces definidas en `architecture_stack.md` §2.2.
- Contiene una instancia inyectable de `CombatEngine`.
- `dispatch(command)` valida el comando, lo ejecuta en el engine, y publica los eventos resultantes a ambos canales.
- Test unitario muestra que un comando genera eventos que se reciben en ambos suscriptores sin duplicación.
- Tipo de evento `CombatEvent` importado desde `packages/domain/combat`.

**Referencia:** `docs/architecture_stack.md` §2.1-2.2, GDD (tipos de eventos).

---

### H2.4: EffectsDirector — mapeo evento→receta de juice (arquitectura desacoplada)

**Descripción:** implementar en `packages/combat-scene/juice` la clase `EffectsDirector` y la tabla `JuiceConfig` (mapeo declarativo evento → recetas); definir la interfaz `JuiceRecipe` que las recetas deben cumplir. El EffectsDirector se suscribe a `subscribeSceneEvents` del bridge y resuelve cada evento contra la tabla para disparar las recetas correspondientes en paralelo o serie según config.

**Criterio de aceptación:**
- `EffectsDirector` clase implementa interfaz de `architecture_stack.md` §3.2.
- `JuiceConfig` es un record `eventType → JuiceStep[]` tipado y editable sin código.
- `JuiceRecipe` interfaz define `id`, `play(scene, target, params)`.
- Al menos 3 eventos tienen recetas mapeadas en JuiceConfig (p.ej. CORE_ROLLED, ABILITY_ACTIVATED, DAMAGE_DEALT).
- Test dummy: crear un mock de `CombatBridge` que emita un evento, verificar que EffectsDirector lo resuelve contra JuiceConfig sin errores.

**Referencia:** `docs/architecture_stack.md` §3.1-3.3, vision.md (feel chulo, forcetable.net/strawtable.net).

---

### H2.5: Recetas de juice base — diceRoll, cardFlip, hitImpact, screenShake

**Descripción:** implementar en `packages/combat-scene/juice/recipes/` las 4 recetas de "feel" prioritarias: `diceRoll` (tween de rotación+escala de dado + particleBurst sutil), `cardFlip` (tween de scaleX flip + cambio de textura a mitad), `hitImpact` (flash de tinte + tween de "punch"), `screenShake` (nativo de Phaser Camera.shake() parametrizado). Cada receta retorna un `Promise<void>` que resuelve cuando la animación termina.

**Criterio de aceptación:**
- Recetas implementadas en archivos separados (1 función por receta).
- `diceRoll`: tween de rotación Y 0→2π + escala 1.2→1 con Timeline, particleBurst al terminar.
- `cardFlip`: tween scaleX 1→0→1 sincronizado con cambio de sprite a scaleX=0.
- `hitImpact`: flash de tint (#fff) + punch scale 1→1.1→0.95→1 en <200ms.
- `screenShake`: `camera.shake(duración, magnitud)` con magnitud parametrizable por cantidad de daño.
- Todas retornan Promise. Test: secuencia de dos recetas seguidas espera la primera.

**Referencia:** `docs/architecture_stack.md` §3.1-3.2, vision.md (forcetable.net/strawtable.net como referencia de "feel").

---

### H2.6: CombatScene base en Phaser — inicialización, loop, suscripción a EffectsDirector

**Descripción:** crear la clase `CombatScene` que extiende `Phaser.Scene`; se inyecta el `CombatBridge` vía `scene.init(data)`; instancia un `EffectsDirector`, se suscribe a los eventos de la escena, y prepara el canvas para el tablero de juego (modo de escala, cámara, layer de fondo). No renderiza objetos aún (H2.8).

**Criterio de aceptación:**
- Clase `CombatScene extends Phaser.Scene` con métodos `preload`, `create`, `update` de Phaser.
- Recibe `CombatBridge` vía `init(data)`.
- Instancia `EffectsDirector` en `create` y lo suscribe vía `bridge.subscribeSceneEvents`.
- `Scale Manager` configurado en modo FIT con viewport virtual (ej. 1080×1920 para móvil).
- Game loop inicializado sin errores; puede levantarse dentro de React.

**Referencia:** `docs/architecture_stack.md` §2.1, §4.2.

---

### H2.7: InputAdapter — traducción de gestos táctiles/ratón a intents semánticos

**Descripción:** implementar en `packages/combat-scene/input` la clase `InputAdapter` que traduce eventos del `Pointer` unificado de Phaser (tap, drag, long-press) a `PlayerIntent` semánticos (SELECT_CARD, CONFIRM_TARGET, CANCEL, PREVIEW_CARD). Se inyecta una escena Phaser y expone un método `onIntent(listener)`.

**Criterio de aceptación:**
- `InputAdapter` clase con métodos `attach(scene)` y `onIntent(listener: (intent: PlayerIntent) => void)`.
- Tap en card → `PlayerIntent { type: 'SELECT_CARD', cardInstanceId }`.
- Long-press o hover+click derecho → `PREVIEW_CARD` (PC es opcional para MVP).
- Drag sobre aliado → intención de redireccionar daño (refere a H1.15, validado en dominio).
- ESC/tap en void → `CANCEL`.
- Test: simular pointer tap sobre un game object y verificar que intent es recibido por listener.

**Referencia:** `docs/architecture_stack.md` §4.3.

---

### H2.8: Renderización de tablero, Núcleos, cartas en mano y en mesa (componentes Phaser)

**Descripción:** implementar en `packages/combat-scene/view` los game objects y funciones que traducen `CombatStateSnapshot` a visuales: tablero de fondo, Núcleos como dados animables, cartas en mano (grupo de sprites), cartas en mesa (Aliados + Enemigo + Escenario), contador de vida/Trama/turno. Estos objetos se crean en `CombatScene.create()` y se actualizan reactivamente cuando el engine emite eventos (sin loop manual, escuchas al bridge).

**Criterio de aceptación:**
- Función `createBoard(scene)` monta layer de fondo (p.ej. tablero simple, fondo de color).
- Función `createCorePool(scene)` crea visuales de los 5+1 Núcleos (dados con valores 1-4, colores por tipo).
- Función `createCardHand(scene)` renderiza cartas en mano (fan-out, clickeable).
- Función `createCardTable(scene)` renderiza cartas en mesa (Aliados jugador, Enemigo, Escenario).
- HUD sobrepuesto (React o texto Phaser) muestra vida, Trama, turno actual.
- Al recibir evento `CORE_SPENT`, visual del core desaparece; al `CORE_ROLLED`, aparecen nuevos.
- Tests visuales: levantar escena con estado mock, verificar que game objects existen y tienen posiciones coherentes.

**Referencia:** `docs/architecture_stack.md` §2.3, §5.

---

### H2.9: Flujo end-to-end jugable — React aloja Phaser, dispatch de comandos, reacción visual

**Descripción:** integrar el componente `<CombatScreen>` (React) que monta un `<PhaserMount>` (envoltorio de Phaser.Game), crea el `CombatBridge` y `CombatScene`, inyecta el bridge en la escena, y conecta la interacción React (botones, menú) con el flujo de intents. Cargar un contenido de juguete 2×2×2 (reutilizar de H1) e iniciar un combate visual que responda a clicks/taps del usuario en cartas/núcleos.

**Criterio de aceptación:**
- Componente React `<CombatScreen>` existe en `apps/shell/screens/CombatScreen.tsx`.
- Monta `<PhaserMount>` que instancia `Phaser.Game` con `CombatScene`.
- Crea `CombatBridge` e inyecta el engine en la escena vía `scene.init(data)`.
- Usuario puede clickear una carta en mano → comando `PLAY_CARD` se dispatch al engine.
- Engine resuelve, emite eventos, Phaser anima, Núcleos desaparecen, cartas se vuelven.
- Contador HUD se actualiza (vida, Trama).
- Loop continúa hasta victoria/derrota (estado final se notifica a React, modal de resultado aparece).

**Referencia:** `docs/architecture_stack.md` §2.1-2.3, §4.2.

---

### H2.10: Cooldowns visuales en cartas y habilidades

**Descripción:** renderizar CD como un número y/o barra visual sobre cada carta/habilidad en mesa; actualizar el visual cada vez que el CD baja (evento `COOLDOWN_TICKED`). Los CD en Phaser se representan como un `Text` o `Graphics` overlay que cambia cuando el evento se emite.

**Criterio de aceptación:**
- Cada carta en mesa/mano tiene un display de CD (número o barra).
- Evento `COOLDOWN_TICKED` triggerza un tween de cambio visual (p.ej. escala + color rojo→verde).
- Carta con CD 0 (disponible para activación) se resalta visualmente.
- Test: emitir `COOLDOWN_TICKED` y verificar que el visual de CD cambió.

**Referencia:** GDD §2.5 (cooldowns), `docs/architecture_stack.md` §2.3.

---

### H2.11: Daño y Trama visuales con animaciones

**Descripción:** renderizar números de vida del Líder y contador de Trama del Escenario; conectar eventos `DAMAGE_DEALT` y `PLOT_CHANGED` para animar cambios de números (tweens de color, escala, floating text). El daño absorbido por Aliados se visualiza sobre el Aliado, no sobre el Líder.

**Criterio de aceptación:**
- Líder y Escenario tienen displays de vida/Trama.
- Evento `DAMAGE_DEALT` triggerza floating damage text y daño sobre su objetivo (Líder o Aliado).
- Evento `PLOT_CHANGED` triggerza tween de número (parpadeo rojo, escala).
- Daño > Trama visible con claridad (diferente color de texto, animación).
- Si Trama llega a umbral de victoria/derrota, se señala visualmente (cambio de color del fondo Escenario, p.ej.).

**Referencia:** GDD §3.6 (Trama), §3.7 (daño y Aliados).

---

### H2.12: Animaciones de Núcleos gastados y pool nuevo rolleado

**Descripción:** conectar eventos `ABILITY_ACTIVATED` (Núcleo gastado) y `CORE_ROLLED` (pool nuevo) a recetas visuales: cuando se gasta un Núcleo, receta de "desaparición" (tween de escala/opacidad), cuando se rolla un nuevo pool, receta `diceRoll` para cada core.

**Criterio de aceptación:**
- Evento `ABILITY_ACTIVATED` dispara animación de desaparición del Núcleo (0.3s).
- Pool vacío → no hay Núcleos en tablero.
- Evento `CORE_ROLLED` dispara `diceRoll` receta para cada Núcleo nuevo (asíncrono, terminan todos antes de "listo para actuar").
- Sonido opcional (referencia a EffectsDirector/JuiceConfig pero implementación de audio diferida a H2.13).

**Referencia:** `docs/architecture_stack.md` §3.1-3.2, GDD §2.3.

---

### H2.13: Audio — sistema básico de cues y mapeo evento→sonido en JuiceConfig

**Descripción:** integrar el `Sound Manager` nativo de Phaser; expandir `JuiceConfig` para que cada `JuiceStep` pueda opcionalmente disparar un sonido (id de track mapeado a ruta en assets); cargar un set mínimo de sonidos (dado rolling, carta flip, hit, victory, defeat) y conectarlos a eventos básicos.

**Criterio de aceptación:**
- `JuiceStep` interfaz extendida con campo `soundId?: string`.
- Mínimo 5 pistas de audio: diceRoll, cardFlip, hit, victory, defeat.
- Assets cargados vía `preload()` de Phaser.
- Evento `CORE_ROLLED` → `diceRoll` sound.
- Evento `ABILITY_ACTIVATED` → `cardFlip` sound (si es válido en ese evento, p.ej. no siempre).
- Evento `COMBAT_ENDED` con outcome='victory' → victory sound.
- Tests de Phaser: verificar que Sound Manager fue llamado con los IDs correctos (mock de audio).

**Referencia:** `docs/architecture_stack.md` §3.2, vision.md (feel chulo incluye sonido).

---

### H2.14: Transición entre pantalla de inicio de run y combate visual

**Descripción:** en `apps/shell`, crear una pantalla stub de "Inicio de Run" que permite seleccionar Líder + pool de Enemigos/Escenarios; al confirmar, navega a `<CombatScreen>` pasando la config via Context o URL params. La pantalla de combate carga el contenido y levanta la escena Phaser.

**Criterio de aceptación:**
- Pantalla `RunStartScreen` existe con botones para seleccionar Líder (dropdown con 2 opciones de juguete).
- Botón "iniciar combate" navega a `<CombatScreen>` pasando Líder ID vía React Router state.
- `<CombatScreen>` carga la definición de Líder del `CatalogLoader` y la usa para iniciar combate.
- Transición suave (fade, loading spinner opcional).

**Referencia:** `docs/architecture_stack.md` §1, decisiones sobre sorteo cruzado (pendiente para H3, aquí solo se implementa el flujo técnico).

---

### H2.15: PWA setup completo — manifest, service worker, instalabilidad básica

**Descripción:** implementar en `apps/shell/pwa` el `manifest.webmanifest` completo (nombre, icono, display standalone, orientación preferente), un service worker funcional con estrategia cache-first para assets estáticos y network-first para datos, y hookear todo en la build de Vite (recomendado vía plugin type vite-plugin-pwa).

**Criterio de aceptación:**
- `manifest.webmanifest` en `apps/shell/public/` con `display: standalone`, `orientation: portrait-primary` (móvil).
- Service worker registrado en entry point de React, cacha bundles estáticos y assets de Phaser.
- PWA instalable en navegadores modernos (Chrome, Firefox móvil) — verificable con Lighthouse o devtools.
- Offline fallback stub (página simple mostrando "app offline, algunos datos pueden no estar disponibles").
- Estrategia: cache-first para `.js, .css, .png, .webp`; network-first para catálogo si es remoto en futuro (hoy empaquetado, cache-first).

**Referencia:** `docs/architecture_stack.md` §4.1, vision.md (PWA instalable).

---

### H3.1: Cableado de input — tap en habilidad del Líder → ACTIVATE_ABILITY

**Descripción:** conectar el gesto de tap/clic en el sprite visual de una habilidad del Líder (renderizada en H2.8) con el comando `ACTIVATE_ABILITY` del engine. El `InputAdapter` ya traduce taps a intents semánticos; esta historia consume ese intent de "SELECT_ABILITY" (nuevo tipo) y lo enruta al `CombatBridge.dispatch(ACTIVATE_ABILITY)`.

**Criterio de aceptación:**
- `InputAdapter` detecta tap en un game object de tipo "habilidad del Líder" y emite intent `{ type: 'SELECT_ABILITY', abilityId }`.
- `PlayerIntent` tipo extendido con nuevo caso `SELECT_ABILITY`.
- `CombatBridge` mapea `SELECT_ABILITY` → comando `ACTIVATE_ABILITY` (validación de CD, Núcleo disponible, acciones, etc. queda en el engine).
- Tap en habilidad con CD > 0 o sin Núcleos: comando se rechaza en el engine, se muestra feedback visual (ej. shake rojo, sonido negativo).
- Tap en habilidad válida: comando se ejecuta, Núcleo se gasta, animación de impacto ocurre, CD se actualiza visualmente.
- Test: simular tap en sprite de habilidad, verificar que `CombatBridge.dispatch()` fue llamado con `ACTIVATE_ABILITY`.

**Referencia:** H2.7 (InputAdapter), H2.8 (renderización de habilidades), decisions.md "Activar una habilidad NO tiene coste adicional de diseño más allá de lo que el motor ya exige hoy".

---

### H3.2: Comando GENERATE_ENERGY en el motor de dominio

**Descripción:** implementar en `packages/domain/combat` el nuevo comando `GENERATE_ENERGY` y su lógica: validar que el Líder es quien actúa, que tiene una acción disponible (de las 2 del turno), que Energía < 5 (máximo), gastar la acción, sumar +1 Energía, emitir evento `ENERGY_GENERATED`.

**Criterio de aceptación:**
- Tipo `GenerateEnergyCommand` definido en `packages/domain/combat/src/types/commands.ts`.
- `CombatEngine.handleGenerateEnergy()` implementado:
  - Valida que es turno del Líder.
  - Valida que tiene ≥1 acción disponible.
  - Valida que Energía < 5.
  - Si una validación falla, rechaza el comando y retorna error (ej. `CombatError` con tipo `INVALID_ACTION`).
  - Si válida, resta 1 acción, suma 1 Energía (tope 5), emite `CombatEvent { type: 'ENERGY_GENERATED', amount: 1 }`.
- `CombatStateSnapshot` refleja cambio de Energía y acciones.
- Tests unitarios parametrizados:
  - Case 1: Energía 0 → Energía 1, acción gasta.
  - Case 2: Energía 4 → Energía 5, tope respetado.
  - Case 3: Energía 5 → error, ya en máximo.
  - Case 4: Sin acciones disponibles → error.
  - Case 5: Turno enemigo → error, no es turno del Líder.

**Referencia:** decisions.md "Generar Energía es una acción explícita del jugador que consume 1 de las 2 acciones del turno", GDD §2.2.

---

### H3.3: Integración de GENERATE_ENERGY en CombatBridge y InputAdapter

**Descripción:** extender `InputAdapter` para que reconozca un gesto/botón nuevo de "generar energía" (ej. un botón visible en el HUD o un gesto largo/doble-tap reservado); mapear ese intent a comando `GENERATE_ENERGY` en `CombatBridge.dispatch()`.

**Criterio de aceptación:**
- Intent nuevo `{ type: 'GENERATE_ENERGY' }` agregado a `PlayerIntent`.
- `InputAdapter` expone un método para registrar listener de botón o gesto de "generar energía" (pode ser un wrapper de `onIntent`).
- `CombatBridge.dispatch()` maneja comando `GENERATE_ENERGY`.
- Evento `ENERGY_GENERATED` es publicado a ambos canales (HUD + Scene).
- Test: emular intent de "generar energía", verificar que `CombatBridge` lo traduce a `handleGenerateEnergy()` en el engine.

**Referencia:** H2.7 (InputAdapter), H2.3 (CombatBridge), decisions.md "Generar Energía es una decisión de ritmo real".

---

### H3.4: Rediseño del modelo de Núcleos — 5 dados fijos + extras + tope en mesa + reroll al vaciar

**Descripción:** implementar el nuevo modelo de pool de Núcleos que reemplaza completamente el anterior (ver decisions.md 2026-07-08). El motor debe:
1. Mantener **5 dados fijos en mesa**, uno por color temático (Rojo, Azul, Verde, Amarillo, Púrpura), más un 6º dado Neutro (⬜) que acepta cualquier coste.
2. Cada dado, al tirarse (inicio de turno o después de gasto), genera un **valor 1-4 de forma independiente**.
3. **Dados EXTRA de color específico** pueden ser añadidos a la mesa por efectos de cartas/equipo del Líder. Ejemplo: "Equipo que añade +1 dado Rojo al pool".
4. Implementar un **tope duro de dados en mesa** (sugerido 10 como valor inicial; ajustable en config para balanceo). Intentos de añadir dados que exceden el tope se ignoran.
5. **Reroll ocurre cuando se gasta el ÚLTIMO dado disponible en mesa** (sin importar color ni dueño). En ese momento se re-tiran **TODOS los dados a la vez** (5 fijos + todos los extras), generando nuevos valores 1-4.
6. Los costes de Núcleo en habilidades y cartas siguen siendo por color/Neutro (no por número mínimo). Validación: se puede pagar un coste ⚫ (Neutro) con cualquier dado en mesa; se puede pagar 🔴 (Rojo) con cualquier dado Rojo en mesa o con un Neutro.
7. Refactorizar H1.3 y H1.13 para validarse contra este nuevo modelo antes de cerrar H3.4.

**Criterio de aceptación:**
- `CorePool` refactorizado a: array de 5 `FixedCore` (fijos, solo trackean valor) + array de `ExtraCore` (dinámicos, llevan color y valor).
- Función `addExtraCore(color: CoreColor)` valida tope en mesa antes de añadir.
- Función `rollAllCores()` se dispara cuando `countRemainingCores() === 1` y se gasta ese último. Genera nuevos valores para todos (fijos + extras).
- Validación de gasto: `canPayCost(coreColor)` retorna true si existe dado en mesa del color requerido O si es Neutro.
- Tests parametrizados:
  - Caso 1: 5 dados fijos solo, valor 1-4 cada uno, reroll en último.
  - Caso 2: 5 fijos + 2 extras (ej. 2 Rojo), total 7, reroll en último.
  - Caso 3: Intento de añadir extra cuando hay 10 dados → se rechaza, tope respetado.
  - Caso 4: Secuencia: gasta 1 Rojo (quedan 6), gasta 1 Neutro (quedan 5), gasta un Azul (quedan 4)... hasta quedan 1 (fijo Púrpura), al gastarlo todos se re-tiran.
  - Caso 5: Pago de coste 🔴 con Rojo disponible vs. fallido si no hay Rojo ni Neutro.
- Pool inicial de juguete: 5 fijos + 0 extras, tope 10.

**Referencia:** decisions.md "Pool de Núcleos" (2026-07-08), H1.3 (motor de turnos, necesita reapertura), H1.13 (tests, necesita reapertura), glossary.md "Pool de Núcleos".

---

### H3.5: UI visual para decisión de turno — botones/estados claros de "jugar", "habilidad", "generar energía"

**Descripción:** en `packages/combat-scene/view` y `apps/shell/screens`, diseñar y renderizar un HUD de decisión que comunique visualmente al jugador cuáles son sus opciones en cada turno: "jugar una carta (si tienes cartas)", "activar una habilidad (si CD=0 y hay Núcleo)", "generar energía (si Energía<5)". El estado debe cambiar dinámicamente según validaciones del engine (ej. si no tienes Núcleo, opción de habilidad se deshabilita/greyed out).

**Criterio de aceptación:**
- En el HUD/overlay visual de combate, existen 3 botones o áreas interactuables: "Jugar Carta", "Activar Habilidad", "Generar Energía".
- Botones cambian de estado (activo/deshabilitado/greyed out) según `CombatStateSnapshot`:
  - "Jugar Carta": deshabilitado si mano está vacía.
  - "Activar Habilidad": deshabilitado si no hay Núcleos disponibles O todos los CD > 0.
  - "Generar Energía": deshabilitado si Energía ≥ 5 O sin acciones disponibles.
- Al menos uno de los tres está siempre disponible (no puedes quedar bloqueado en el menú de selección).
- Evento `ACTION_SPENT` actualiza los botones para reflejar el cambio de estado.
- Visual claro (diferente color, opacidad, tooltip) que distingue "disponible" de "no disponible".

**Referencia:** H2.9 (flujo end-to-end), H3.1 (cableado de habilidad), H3.3 (integración de generar energía), decisions.md sobre estructura de decisión de turno.

---

### H3.6: Paso previo gratis de turno — robar carta o generar energía

**Descripción:** implementar una **nueva fase al inicio del turno del Líder, antes de las 2 acciones pagadas**: el Líder puede elegir entre **robar 1 carta de su mazo** o **generar +1 Energía** (máximo 5). Esta acción es **gratis** (no consume ninguna de las 2 acciones del turno) y ocurre una sola vez al inicio, antes de cualquier otra decisión. Si el mazo está vacío, la opción de robo se deshabilita (pero generar energía sigue disponible).

**Criterio de aceptación:**
- Nuevo comando `DRAW_OR_GENERATE` en el motor que acepta parámetro `action: 'draw' | 'generate'`.
- El comando es válido solo al inicio del turno del Líder y solo una vez por turno.
- Si `action: 'draw'`, roba 1 carta (mano aumenta en 1, respetando tope de 7; si mazo vacío, rechaza con error `CANNOT_DRAW_EMPTY_DECK`).
- Si `action: 'generate'`, suma +1 Energía (tope 5; si ya en máximo, rechaza con error `ENERGY_AT_MAX`).
- Evento emitido: `DRAW_OR_GENERATE_EXECUTED { action, result }` (ej. `{ action: 'draw', result: cardId }` o `{ action: 'generate', result: newEnergyAmount }`).
- Después de ejecutar, el turno avanza a la fase de 2 acciones pagadas normales (H3.1, H3.3).
- Mano inicial fijada en 5 cartas (era undefined en H1, ahora se especifica); tope de mano en 7.
- Tests parametrizados:
  - Caso 1: Turno del Líder, elige draw, mazo con cartas → 1 carta entra en mano, acción gratis gastada, faltan 2 acciones pagadas.
  - Caso 2: Turno del Líder, elige draw, mazo vacío → error `CANNOT_DRAW_EMPTY_DECK`.
  - Caso 3: Turno del Líder, elige generate, Energía < 5 → +1 Energía, acción gratis gastada.
  - Caso 4: Turno del Líder, elige generate, Energía = 5 → error `ENERGY_AT_MAX`.
  - Caso 5: Turno enemigo → comando rechazado, no es válido.
  - Caso 6: Segunda llamada a `DRAW_OR_GENERATE` en el mismo turno → rechazado, solo una vez.

**Referencia:** decisions.md (2026-07-08) "Estructura de turno del jugador ampliada", H3.5 (UI de decisión de turno debe mostrar esta opción gratis), H1.18 (motor de combate, debe modelar esta fase).

---

### H3.7: Targeting explícito de ataques — elegir objetivo (Enemigo o Secuaz)

⚠️ **PRIORITARIO / BLOQUEANTE PARA JUGABILIDAD REAL**

**Descripción:** implementar el sistema de targeting explícito que permite al jugador elegir el destino de un ataque: puede dirigirse al Enemigo directo o a cualquier Secuaz válido en mesa. Esta decisión es táctica y requiere interfaz clara en el motor (campo `targetId` en comando `PLAY_CARD` / `ACTIVATE_ABILITY` cuando el efecto es dañante) y en la UI (indicador visual de objetivo seleccionado antes de confirmar el ataque).

**Por qué es bloqueante:** sin targeting explícito, un combate contra un Enemigo rodeado de Secuaces no es jugable de forma completa — el jugador no puede tomar la decisión principal del combate (atacar al Enemigo vs. limpiar Secuaces). Esto hace que el cierre del loop jugable (E3) sea incompleto sin esta pieza.

**Criterio de aceptación:**
- Comando `PLAY_CARD` y `ACTIVATE_ABILITY` aceptan parámetro opcional `targetId: string` (ID del Secuaz) o `null`/undefined (Enemigo directo).
- Motor valida que `targetId` corresponde a un Secuaz en mesa (si se proporciona).
- Si es un Secuaz atacado y tiene keyword Defensor, valida que ese Defensor es atacado primero (rechazo si no).
- Efecto del ataque (daño) se aplica al objetivo elegido.
- Evento `DAMAGE_DEALT` incluye campo `targetId` para que la UI animar el daño al objetivo correcto.
- **Interfaz de selección (H3.8 toca la UI visual; aquí es solo lógica de motor):**
  - Antes de jugar una carta de Ataque o activar una habilidad de daño, el motor debe validar cuántos objetivos válidos hay.
  - Si hay 0 Secuaces en mesa (solo Enemigo), targeting se asume automático al Enemigo (sin UI de selección).
  - Si hay ≥1 Secuaz, comando requiere que `targetId` sea especificado explícitamente (la UI de H3.8 presenta las opciones).
  - Si `targetId` falta en un caso donde es requerido, comando se rechaza con error `TARGET_REQUIRED`.
- **Símetría con Aliados:** redirección de daño hacia Aliado propio (H1.15) sigue siendo automática (Aliado bloquea); redirección hacia Secuaz enemigo es manual (selección del jugador).
- Tests parametrizados:
  - Caso 1: Jugar Ataque, 0 Secuaces en mesa → targetId indiferente, daño va al Enemigo.
  - Caso 2: Jugar Ataque, 1 Secuaz sin Defensor, targetId=secuazA → daño va a Secuaz.
  - Caso 3: Jugar Ataque, 1 Secuaz sin Defensor, targetId=null → daño va al Enemigo (jugador eligió no atacar Secuaz).
  - Caso 4: Jugar Ataque, 2 Secuaces (uno Defensor, otro normal), sin targetId → error `TARGET_REQUIRED`.
  - Caso 5: Jugar Ataque, 1 Secuaz Defensor, targetId=otro Secuaz sin Defensor → error `DEFENDER_HAS_PRIORITY`, Defensor debe ser atacado.
  - Caso 6: Daño > Vida Secuaz, Arrollar present → exceso va al Enemigo; sin Arrollar → exceso se pierde.

**Referencia:** decisions.md 2026-07-08 "Vida de Secuaz: mecánica mínima para HP propia" §1 (Targeting), H1.15 (absorción de daño por Aliados, contraste), H1.16 (Secuaces con HP), GDD §3.8 (Secuaces), Marvel Champions (referencia explícita del Director Creativo).

---

### H3.8: UI visual de targeting — selector de objetivo antes de confirmar ataque

**Descripción:** implementar en `packages/combat-scene/view` y `InputAdapter` la interfaz visual que permite al jugador elegir el objetivo de un ataque cuando hay múltiples opciones en mesa (Enemigo + Secuaces). Al seleccionar una carta de Ataque o habilidad de daño, si hay Secuaces en mesa, se abre un modal/overlay que muestra los objetivos válidos; el jugador toca/clickea el objetivo deseado y confirma, lo que dispara el comando al `CombatBridge` con `targetId` correcto.

**Criterio de aceptación:**
- Intent nuevo en `InputAdapter`: `{ type: 'SELECT_ATTACK_TARGET', targetId }` (targetId puede ser ID del Enemigo o de un Secuaz).
- Cuando se selecciona una carta de Ataque con destino dañante (p.ej. palabra clave "Ataque"), antes de ejecutar se valida si hay Secuaces en mesa.
- Si hay Secuaces (y no todos están con Defensor excepto uno), se abre selector de objetivo (modal overlay u overlay en tablero).
- Selector muestra: miniatura/nombre del Enemigo + miniaturas/nombres de cada Secuaz en mesa, con estado visual (vida actual/máxima, icono Defensor si aplica).
- Si hay un Defensor, se resalta visualmente forzando su selección (ej. botón deshabilitado en otros, o tooltip).
- Al tocar un objetivo, comando `PLAY_CARD` o `ACTIVATE_ABILITY` se despacha con `targetId` correspondiente.
- Si mano anterior se cierra sin seleccionar (tap fuera o ESC), selector se cancela y el ataque no se ejecuta.
- Caso especial: si NO hay Secuaces en mesa, el selector no aparece — el ataque se ejecuta directamente al Enemigo sin pedir confirmación.
- Tests visuales: levantar combate con Secuaces, simular selección de Ataque, verificar que overlay selector aparece y contiene opciones correctas.

**Referencia:** H3.7 (lógica de targeting en motor), H2.8 (renderización de Secuaces), H2.7 (InputAdapter base), decisions.md "Targeting: el jugador SÍ puede dirigir daño explícitamente a un Secuaz".

---

### E4: Rediseño de UI/UX — usabilidad visual y delimitación en interfaz de combate

Overhaul visual de la pantalla de combate y pantalla de inicio de run para mejorar legibilidad, delimitación de zonas y comunicación clara de estados. El feedback explícito del Director Creativo tras jugar H2 desplegado: "el feeling no me gusta, el negro de la pantalla de selección no se ve, me gustaría que los inicios de turno se vieran bien, que estuviera todo bien delimitado, que la elección fuera en un popup". Scope acotado: rediseño de layout y componentes visuales (no cambio de mecánicas, que ya están cerradas y validadas por QA). Prioridad: el "feel" visual que ya era objetivo explícito del Director Creativo en decisions.md 2026-07-06 ("prioridad explícita: el feel chulo del combate por encima de la simplicidad de implementación"), ahora evidenciado en la laguna real del H2 desplegado.

---

### H4.1: Popup/modal de selección de Líder/Enemigo/Escenario en RunStartScreen

**Descripción:** refactorizar la pantalla `RunStartScreen` que hoy muestra selectores planos (radio buttons sin contraste sobre fondo negro). Reemplazar con un **popup/modal centrado y bien delimitado** que presenta opciones visuales (tarjetas con nombre/arte del Líder, con Enemigo/Escenario seleccionable también en modal separado o en cascade). Modal debe tener fondo con contraste suficiente (p.ej. fondo translúcido oscuro con panel interior de color sólido o gradiente), bordes claros, y botones de confirmación/cancelación obvios. El flujo debe ser: 1. Modal de selección de Líder (tarjetas grandes, navegables), 2. Modal de selección de Enemigos/Escenarios (pool visual 3+3), 3. Vista previa del sorteo/asignación, 4. Botón de inicio.

**Criterio de aceptación:**
- `RunStartScreen` reemplaza selectores planos por modal centrado con fondo diferenciado.
- Líder, Enemigos y Escenarios se presentan como tarjetas visuales (no listas de texto).
- Modal tiene bordes y separación clara del fondo de la pantalla (p.ej. `border-radius`, `box-shadow`, fondo translúcido fuera del modal).
- Botones de confirmar/cancelar son visibles y bien delimitados (suficiente tamaño táctil ≥44px en móvil).
- Flujo es claro: no hay ambigüedad sobre qué se está seleccionando en cada paso.
- Pantalla de vista previa del sorteo (3 cruces Enemigo×Escenario) muestra orden de combates de forma clara (N1, N2, N3) antes de iniciar.

**Referencia:** decisions.md 2026-07-05 "El sorteo cruza, el jugador ordena"; GDD §7.2 (orden de run); feedback del Director Creativo.

---

### H4.2: Sistema de paneles y delimitación visual en pantalla de combate

**Descripción:** rediseñar el layout de `CombatScene` para que todas las zonas de la pantalla estén **claramente delimitadas por paneles visuales con contraste y jerarquía**. Identificar las 6-8 zonas principales (Núcleos/Pool en el centro, mano del jugador (abajo), Líder (arriba en columna vertical o esquina), Enemigo (arriba contrario), Escenario (lado contrario), Aliados/Secuaces (lado contrario), HUD de info (esquinas, barra superior)). Cada zona debe tener su propio **panel de fondo**, **borde/separador**, y **padding/spacing consistente** que las distingua visualmente. Tema oscuro pero legible (no negro plano #000): fondo base ~#0a0a0a a #1a1a1a, paneles secundarios ~#222-#333, textos claros, acentos en color temático.

**Criterio de aceptación:**
- Layout de combate divide el canvas en 6-8 zonas etiquetadas visualmente.
- Cada zona tiene su propio panel de fondo (color, opacidad, borde) diferenciado.
- Núcleos/Pool: área central clara, dados visibles con espacio.
- Mano del jugador: panel inferior con fondo distinguible, cartas organizadas en fan o lista legible.
- Líder: panel con vida/Trama visibles, en posición clara (arriba o esquina).
- Enemigo: panel contrario al Líder, simétrico en legibilidad.
- Escenario: panel independiente que muestra identidad y contador de Trama.
- Aliados/Secuaces: zonas separadas para ambos lados, sin superposición.
- HUD de info (turno, acciones disponibles, Energía): posición fija (p.ej. barra superior o esquina) con fondo semi-transparente si es overlay.
- Paleta de color coherente: fondo base oscuro, paneles en grises neutrales, acentos en colores temáticos de los Núcleos (rojo/azul/verde/amarillo/púrpura).
- Espaciado y alineación consistentes en toda la pantalla (se ve profesional, no flotando sin jerarquía).

**Referencia:** vision.md (referencias forcetable.net/strawtable.net para feel); decisions.md 2026-07-06 "prioridad explícita: el feel chulo del combate por encima de la simplicidad de implementación"; feedback del Director Creativo.

---

### H4.3: Indicador visual claro de inicio/cambio de turno

**Descripción:** implementar un sistema visual que comunique **explícitamente cuándo cambia el turno entre el jugador y el Enemigo**. Opciones visuales (Architect elige una o combina varias): (a) animación de transición: screen fade a negro/efecto overlay con texto "Tu turno" / "Turno del Enemigo", (b) icono/banner en el HUD que se anima/pulsa cuando cambia, (c) animación de los dados/nucleo pool que señala "nueva ronda disponible", (d) efecto de screen shake suave al cambiar de turno. El evento `TURN_CHANGED` ya existe en dominio (H1.18); esta historia conecta ese evento a una receta visual clara. No debe ser molesto (no bloquear el juego >1 segundo), pero sí **inevitable que el jugador lo vea**.

**Criterio de aceptación:**
- Evento `TURN_CHANGED` (o equivalente que dispara cambio de turno) desencadena una receta de juice visual.
- Receta incluye al menos uno de: transición de pantalla (fade/overlay con texto), animación de icono/banner en HUD, efecto sobre los Núcleos, screen shake suave.
- Duración total del efecto: <1 segundo (no bloquea acción; si hay animaciones paralelas, todo resuelve antes de que el juego pida siguiente acción).
- Indicador es lo suficientemente obvio que un jugador casual lo verá sin necesidad de tutorial (no es un texto pequeño, no es un color muy similar al fondo).
- Después del efecto, el HUD refleja claramente quién tiene turno ahora (p.ej. texto "Tu turno" con countdown de acciones, o resalte de zona de decisión del jugador).
- Tests visuales: reproducir secuencia de turno (Líder → Enemigo → Líder), verificar que efecto se dispara cada vez.

**Referencia:** H1.18 (evento `TURN_CHANGED` en motor); H2.5 (recetas de juice base); H2.4 (EffectsDirector, mapeo evento→juice); decisions.md 2026-07-08 "Estructura del turno del jugador" (ahora con transición visual explícita).

---

### H4.4: Comunicación clara de opciones de acción disponibles en el HUD de turno

**Descripción:** mejorar el HUD/overlay de decisión de turno (parcialmente cubierto en H3.5) para que comunique **de forma cristalina** cuáles son las 4 opciones de acción del jugador en cada turno y cuál es su estado validado: (1) Jugar Carta (deshabilitado si mano vacía), (2) Activar Habilidad (deshabilitado si no hay Núcleos o todos los CD > 0), (3) Generar Energía (deshabilitado si Energía ≥ 5 o sin acciones), (4) Pasar Turno. Cada opción debe ser **distinguible visualmente** (botón, tooltip, icono + texto claro). El HUD debe refrescar en tiempo real según `CombatStateSnapshot` — si se gasta un Núcleo, "Activar Habilidad" se deshabilita si era el último; si se roba una carta, "Jugar Carta" se habilita. Layout: si es posible, todas las opciones en el mismo panel HUD sin scrolling en móvil (layout responsivo, ajustar tamaño de texto/botones si es necesario). Incluir también contador de "acciones disponibles del turno" (2/2, 1/2, 0/2) visible siempre.

**Criterio de aceptación:**
- HUD de turno muestra 4 botones/áreas de opción: Jugar Carta, Activar Habilidad, Generar Energía, Pasar Turno.
- Cada opción tiene estado visual claro: activo (color normal, clickeable), deshabilitado (greyed out, opacity reducida, no clickeable), en-cooldown (tooltip/icono que explica por qué está deshabilitado).
- Estados se actualizan en tiempo real cuando `CombatStateSnapshot` cambia.
- Contador de acciones visibles siempre en el HUD (p.ej. "Acciones: 2/2", y disminuye cada vez que se gasta una).
- Tooltip o icono sobre botones deshabilitados que brevemente explica por qué (p.ej. "Sin Núcleos disponibles" en "Activar Habilidad" si no hay Núcleos).
- Layout responsivo: en móvil (viewport <600px ancho), todos los botones caben sin overflow o necesidad de scroll del HUD; en desktop, similar sin ocupar >20% de la pantalla.
- Feedback visual al hacer clic: estado que cambia, o animation de click (p.ej. brief pulse/tint change) que confirma la interacción.

**Referencia:** H3.5 (UI de decisión de turno inicial); H3.1-H3.3 (cableado de input); decisions.md 2026-07-08 "Estructura del turno del jugador" (4 opciones explícitas).

---

## Bugs
