# Decisions

Este documento almacena decisiones permanentes.

Cada decisión debe explicar:

- qué se decidió

- por qué

- cuándo

Nunca eliminar decisiones antiguas.

---

## 2026-07-05 — Validaciones de mecánicas core (Director Creativo + Game Designer)

Formalizadas hoy; validadas durante la conversación de revisión del GDD v1. Sustituyen a lo que el GDD v1 diga en contra (pendiente GDD v2).

- **Costes de habilidad solo por color/genérico, nunca número mínimo.** La notación ⚫3/🔴3 del GDD v1 queda obsoleta. El valor del Núcleo (1-4) alimenta la fórmula vía Umbral, no la condición de pago. *Por qué:* simplifica la lectura de costes y evita turnos bloqueados por valores bajos.
- **Cooldown baja 1 por vuelta completa** (cuando te vuelve a tocar), no por acción individual.
- **Al relanzar el pool de Núcleos, elige primero quien tenga el turno inmediatamente después del vaciado.**
- **Trama la recibe el Escenario; daño lo recibe el Líder** — habilidades separadas del Enemigo.
- **Habrá habilidades de color neutro** para que ningún color de dado quede sin uso.
- **Plataforma: móvil primero, adaptable a PC, testeo en navegador.** Referencia de feel: forcetable.net, strawtable.net.
- **Alcance MVP: 8 Líderes, 4 Enemigos, 4 Escenarios, 2 universos** (ej. Star Wars, One Piece).
- **Just for fun:** sin monetización, sin restricción por licencias reales.
- **Matriz de completitud Enemigo×Escenario×Nivel persiste entre runs.** Los Créditos compran sobres entre runs, nunca dentro de una run.

## 2026-07-05 — Estructura de la run y meta-progresión (Director Creativo + Fable 5)

### El sorteo cruza, el jugador ordena
- **Qué:** al iniciar una run eliges Líder + mazo y un pool de 3 Enemigos + 3 Escenarios. El juego sortea los 3 cruces Enemigo×Escenario (puede mezclar universos), los revela, y el jugador asigna qué cruce va a N1, N2 y N3.
- **Por qué:** azar en lo táctico, control en lo estratégico. No eliges contra qué luchas, pero planificar el orden de escalada es una decisión rica y hace que la pantalla de inicio de run ya sea juego. Cruzar universos es la fantasía central del Collector y duplica la matriz de completitud (~48 celdas) sin contenido extra. La nota previa de "2 universos independientes" se refiere a sets de contenido, no a un muro mecánico.

### El Líder se elige antes del sorteo
- **Qué:** Líder y mazo se fijan junto con el pool de 3+3, antes de conocer los cruces.
- **Por qué:** la selección del pool ya es estratégica ("elijo rivales que mi mazo maneja bien") y el sorteo pone a prueba la adaptabilidad, que es lo que las mejoras entre combates deben resolver.

### Derrota = fin de run inmediato (roguelite puro)
- **Qué:** perder cualquier combate termina la run. Se conservan las recompensas de objetivos ya cumplidos (regla previa del GDD).
- **Por qué:** máxima tensión; cada combate importa. Convierte Reparación entre combates en una decisión de supervivencia real. Decisión del Director Creativo frente a las alternativas más amables (reintento o continuar con penalización).

### Nivel = slot de la run, sin desbloqueo permanente
- **Qué:** batalla 1 = N1, batalla 2 = N2, batalla 3 = N3. Cualquier enemigo puede aparecer a cualquier nivel sin requisitos previos. La matriz Enemigo×Escenario×Nivel es un registro de logros, no un sistema de puertas. Sustituye al desbloqueo por enemigo del GDD v1 (§5.2).
- **Por qué:** el desbloqueo permanente contradecía el sorteo de la run y añadía fricción sin diversión. La insignia de N3 conserva su prestigio como logro registrado.

### Celdas repetidas: Créditos base; primera completitud da bonus
- **Qué:** completar una celda ya completada da los Créditos base de esa batalla (más sus objetivos secundarios). La primera completitud de una celda da un bonus fijo (orden de +50% Créditos) además del avance hacia insignias.
- **Por qué:** lo nuevo atrae sin que repetir frustre; la batalla jugada siempre paga.

### Mejoras entre combates: Refuerzo o Reparación (sin espionaje, sin Créditos)
- **Qué:** entre combates de una run aparece una pantalla de descanso con 2 vías excluyentes — **Refuerzo** (se ofrecen 3 cartas de tu colección, metes 1 temporalmente en el mazo de esta run) o **Reparación** (curas al Líder). No se puede comprar poder con Créditos a mitad de run. La vía de espionaje/información queda descartada: el sorteo ya revela los cruces al inicio.
- **Por qué:** trade-off poder-vs-supervivencia claro y legible; con fin-de-run inmediato, Reparación tiene peso real. Lo temporal nunca toca la colección permanente.
- **⚠️ Sustituida el 2026-07-05** por la sección "Descanso entre combates y evolución de la baraja" (más abajo): las dos vías excluyentes desaparecen — la cura pasa a ser automática y siempre ocurre, y "Refuerzo" se redefine como evolución de cartas de la baraja de la run (no cartas sueltas de la colección).

## 2026-07-05 — Descanso entre combates y evolución de la baraja (Director Creativo + Game Designer)

Formaliza la ronda 2 de `docs/open_questions.md` y el análisis previo en `docs/design_notes_evolucion_cartas.md`. **Sustituye por completo** a la decisión anterior "Mejoras entre combates: Refuerzo o Reparación (sin espionaje, sin Créditos)" del mismo día: las vías excluyentes desaparecen. La pantalla de descanso entre los 3 combates de una run pasa a tener **tres cosas que ocurren siempre, no una elección entre vías**:

### (a) Auto-recuperación del 50% de vida máxima, para todos, siempre
- **Qué:** la vida del Líder persiste entre los 3 combates de la run (no se resetea). Entre cada combate, el Líder recupera automáticamente el 50% de su vida máxima, con tope en el máximo. Ocurre siempre, sin elección del jugador y sin coste de oportunidad.
- **Por qué:** decisión explícita del Director Creativo, en contra de la recomendación del Game Designer (que proponía la Lectura B — cura solo si eliges la vía Reparación, para que compita con Refuerzo). El Director prioriza la generosidad: el fin-de-run inmediato ya castiga con dureza, y esta auto-cura evita que una sola mala racha de daño en el combate 1 sentencie la run sin remedio antes de llegar al combate 2.
- **Nota de diseño (advertencia mantenida):** al eliminar el trade-off "cura vs. poder", la vía de "Reparación" como decisión desaparece del todo — ya no compite con nada. El Game Designer marca esto como decisión ya tomada por el Director, no una recomendación de diseño.

### (b) Evolución de cartas: elige 1 de 3, plantillas genéricas parametrizadas por tipo
- **Qué:** en cada descanso se ofrecen 3 opciones de evolución de cartas del mazo actual de la run; el jugador elige 1. Para el MVP, el contenido se implementa como un catálogo pequeño de **plantillas de mejora genéricas parametrizadas por tipo de carta** (Ataque, Trama, Equipo, Aliado, Contratiempo, etc. — ver tabla en `docs/design_notes_evolucion_cartas.md` §2), no como una versión evolucionada escrita a mano por carta.
- **Tope:** máximo **1 evolución por carta por run**. Evolucionar una carta evoluciona **todas sus copias** en el mazo (si llevas 2, evolucionan las 2).
- **Por qué:** refuerza la identidad del mazo ya construido en vez de diluirla con cartas nuevas que compiten con lo ya elegido; dota de función real a llevar copias duplicadas en el deck-building previo; el enfoque de plantillas mantiene el coste de contenido bajo sin renunciar a que cada evolución se sienta pensada para esa carta.
- **Puerta abierta explícita:** el diseño de datos de las cartas debe dejar sitio para migrar, más adelante y fuera del MVP, a evoluciones únicas diseñadas a mano por carta (especialmente Únicas/Líder) sin tener que rehacer el modelo. La plantilla parametrizada es la solución de lanzamiento, no la solución definitiva.

### (c) Level-Up del Líder entre batallas: elige qué habilidad sube, no excluyente con (b)
- **Qué:** entre combates, el Líder también sube de nivel y el jugador elige qué habilidad del Líder mejorar — el mismo gesto de "elige 1 de 3" que ya existe para el Level-Up dentro de combate (GDD §6.3), pero como una decisión propia del descanso, independiente del pool de evolución de cartas.
- **Por qué:** el Director Creativo decide explícitamente que evolución de carta y Level-Up del Líder **no son excluyentes** — ambas ocurren en el mismo descanso, cada una como su propia elección. Esto descarta la propuesta previa del Game Designer de mezclar ambas en un único pool de "elige 1 de 3" para no saturar la pantalla; el Director prefiere dos decisiones separadas y explícitas.

### Cierres de la ronda 3 (2026-07-05, Director Creativo)
- **Level-Up del Líder: un único contador por run.** Los niveles ganados dentro del combate y los ganados entre batallas comparten el mismo contador y tope de la run. *Por qué:* un solo sistema que leer y balancear; evita explicar dos carriles de progresión del Líder.
- **Agotamiento del pool de evoluciones: caso descartado por imposible.** Con un mazo de 30 cartas y un máximo de 2 descansos por run, nunca se agotan las cartas elegibles. No se diseña compensación ni regla especial; no es un caso a contemplar.

### Estructura final de la pantalla de descanso (resumen)
1. Auto-cura del 50% de vida máxima — automática, sin elección.
2. El jugador elige 1 de 3 evoluciones de carta.
3. El jugador elige qué habilidad del Líder sube de nivel.

Las tres ocurren siempre, en el mismo descanso, sin vías excluyentes entre ellas.

## 2026-07-05 — Stack técnico (Director Creativo + Architect)

Primer registro de stack técnico del proyecto. Hasta esta fecha no había motor/lenguaje fijado; a partir de aquí queda vinculante para Architect y Programmer.

- **TypeScript + React** para el shell de la aplicación: menús, pantalla de inicio de run (elección de Líder/mazo/pool 3+3, sorteo cruzado), colección/deckbuilding en la habitación, pantalla de descanso entre combates, economía/sobres.
- **Phaser** (sobre el mismo runtime TypeScript) para la escena de combate: tablero de juego, dados/Núcleos, cartas jugadas, animaciones, cooldowns visuales, secuaces, efectos.
- **Empaquetado como PWA instalable en móvil** (manifest + service worker), adaptable a PC, testeable en navegador durante desarrollo. Reafirma la decisión de plataforma ya registrada el 2026-07-05 ("móvil primero, adaptable a PC, testeo en navegador").
- **Prioridad explícita del Director Creativo: el "feel chulo" del combate por encima de la simplicidad de implementación.** Dados rodando, cartas volteando, golpes con impacto, screen shake, partículas, sonido — referencia forcetable.net / strawtable.net (ya citada en vision.md). Esto condiciona la arquitectura de la escena Phaser: debe dejar sitio de primera clase a tweens, partículas y gestión de "juice", no tratarlo como añadido posterior.
- **Por qué este stack:** React da velocidad y ecosistema maduro para las pantallas de gestión/menú (no necesitan motor de juego); Phaser es el motor 2D más usado para dar "feel" de juego de cartas/dados en canvas con buen soporte táctil y de partículas; ambos corren en TypeScript, compartiendo lenguaje y permitiendo compartir la capa de dominio/reglas (Núcleos, cooldowns, Umbral, Trama, etc. del GDD) sin duplicarla ni acoplarla a ningún framework de UI. PWA cubre el requisito de instalable en móvil sin tiendas de apps nativas, ya decidido en vision.md.
- Detalle de estructura de módulos, puente React↔Phaser y enfoque de "juice": ver `docs/architecture_stack.md`.
