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

**Estado:** COMPLETADO (19 historias H1.1-H1.19 implementadas, revisadas, con QA; 361 tests, 97% cobertura).

---

### H2: Vertical slice visual con Phaser — puente React↔Phaser, EffectsDirector, primer combate jugable

**Objetivo:** montar la capa visual sobre el motor de H1. Que un usuario pueda jugar un combate completo viendo tablero, dados rodando, cartas volteando, golpes con impacto animado, cooldowns, daño y Trama. Riqueza visual explícitamente pedida (referencias forcetable.net/strawtable.net).

**Alcance:**
- `packages/combat-scene`: Phaser, EffectsDirector, recetas de juice, InputAdapter, componentes visuales (Board, Cores, Cards, HUD).
- `packages/ui-shared`: componentes React reutilizables (habitación del coleccionista, design system).
- `apps/shell`: React + Vite, pantalla de inicio de run, `<CombatScreen>` que monta Phaser, navegación entre pantallas.
- `apps/shell/combat-bridge`: comunicación síncrona entre engine y vistas.
- PWA: manifest + service worker funcional, instalable en móvil.
- Audio: cues de dados, cartas, golpes, victoria, integradas en JuiceConfig.

**Criterio de éxito:**
- Combate visual jugable end-to-end: clickear cartas, ver daño/Trama/CD animados, ganar/perder con UI responsiva.
- Juego corre en móvil (simulador o física) sin jank; dados ruedan y se asientan <500ms.
- PWA instalable en Chrome móvil, ejecutable offline con fallback (no requiere conexión).

**Próximo hito:** H3 (cierre de ciclo jugable de combate base — activar habilidades, generar energía, pool de Núcleos ajustado).

---

### H3: Cierre del ciclo jugable de combate — cableado de input, Generar Energía, ajuste de pool

**Objetivo:** completar las piezas centrales faltantes para que el combate sea realmente jugable: permitir que el jugador active habilidades del Líder vía input táctil, implementar la acción "Generar Energía" como decisión explícita de ritmo, y ajustar el tamaño del pool de Núcleos a 8 para mejorar la varianza de color. Todos los cambios son de alcance cerrado: sin contenido nuevo, sin ampliación de mecánicas, solo pulimiento de lo que H1+H2 dejaron sin conectar.

**Alcance:**
- `packages/combat-scene/input`: cableado de tap a habilidad del Líder → comando `ACTIVATE_ABILITY`.
- `packages/domain/combat`: comando `GENERATE_ENERGY` y su lógica (validación, aplicación, tests).
- `packages/combat-scene/view` + `apps/shell/screens`: UI visual que comunique al jugador que "pasar turno" y "generar energía" es una opción real (botón o gesto).
- Constante `DEFAULT_NUCLEO_POOL_SIZE` sube de 6 a 8; tests ajustados.

**Criterio de éxito:**
- Tap/clic en habilidad del Líder dispara `ACTIVATE_ABILITY` al engine, valida reglas, consume Núcleo, anima resultado.
- Jugador puede elegir explícitamente "generar energía" en su turno (+1 de Energía, tope 5, consume 1 acción).
- Pool de 8 fichas se rolla al vaciarse; tests de Núcleos pasan con nuevo tamaño.
- Flujo de decisión en turno es claro: "jugar carta", "activar habilidad" o "generar energía".

**Próximo hito:** H4 (rediseño visual de UI/UX — usabilidad, delimitación, indicadores de turno).

---

### H4: Rediseño visual de UI/UX — usabilidad y delimitación en interfaz de combate

**Objetivo:** cerrar la laguna de "feel" visual detectada por el Director Creativo tras jugar H2 desplegado. El feedback es claro: pantalla de selección de run no visible (negro plano, sin contraste), falta de delimitación de zonas en combate (todo flota sin jerarquía), ausencia de indicadores visuales para cambios de turno. Scope: refactorizar layout de combate con paneles delimitados, reemplazar selectores planos de RunStartScreen por modales visuales, y conectar evento de cambio de turno a efecto visual obvio. **Sin cambios de mecánicas** — todas las reglas de H1+H2+H3 se mantienen; esto es solo pulimiento visual.

**Alcance:**
- `RunStartScreen`: popup/modal centrado con tarjetas visuales para Líder/Enemigos/Escenarios (reemplaza selectores planos).
- `CombatScene/view`: refactorizar layout en 6-8 paneles delimitados (Núcleos, mano, Líder, Enemigo, Escenario, Aliados/Secuaces, HUD) con contraste visual y jerarquía clara.
- Paleta de color: tema oscuro legible (~#0a0a0a base, ~#222-#333 paneles, textos claros, acentos en colores temáticos).
- `EffectsDirector/JuiceConfig`: receta visual para evento `TURN_CHANGED` (transición, icono/banner, screen shake — Architect elige).
- HUD de turno mejorado: 4 opciones de acción con estado visual claro, tooltip para deshabilitados, contador de acciones siempre visible.

**Criterio de éxito:**
- RunStartScreen: popup modal visible sin ambigüedad, bordes y contraste claros, flow intuitivo (Líder → Enemigos/Escenarios → vista previa → inicio).
- CombatScene: todas las 6-8 zonas delimitadas por paneles, cada una con borde/fondo/spacing consistente, layout responsivo en móvil/desktop.
- Cambio de turno: efecto visual <1s que es inevitable de ver (fade overlay con texto, animación en HUD, o screen shake).
- HUD: 4 botones de acción con estado en tiempo real, tooltip, contador de acciones siempre visible, layout responsivo sin scroll en móvil.
- Feedback cualitativo: Director Creativo juega la build y confirma que "se ve bien, está delimitado, es usable".

**Próximo hito:** H5 (meta-progresión, pantalla de descanso entre combates, evolución de cartas, Level-Up del Líder entre batallas).