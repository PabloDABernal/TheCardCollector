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

## 2026-07-05 — Cierre de dudas del motor de combate (Director Creativo)

Resuelven las 3 dudas que bloqueaban historias de la Épica E1 (backlog.md), detectadas por Coordinator al desglosar el motor de combate.

- **Coste de Energía de las habilidades: por norma, NO tienen coste de Energía asociado.** Solo bajar una carta de mano a mesa/resolver su efecto paga Energía (GDD §2.2); activar una habilidad de Líder/Aliado/Enemigo consume Núcleo pero no Energía salvo excepción explícita. *Por qué:* regla general más simple; deja abierta la puerta a que una habilidad concreta pida Energía como excepción puntual en el futuro, pero no es la norma.
- **Energía inicial del Líder: 1.** El combate empieza con 1 de Energía (máximo sigue siendo 5, +1 por Generar Energía). *Por qué:* coherente con que las habilidades no cuesten Energía por norma — el 1 inicial da margen para bajar una carta barata desde el primer turno sin necesitar generar antes.
- **Level-Up del Líder dentro de combate: checkpoint de cambio de fase del Enemigo o del Escenario.** El trigger es la fase, no un porcentaje de vida/Trama: cada vez que el Enemigo o el Escenario activo cambia de fase, se dispara un checkpoint de Level-Up. En el contenido de MVP, Enemigos y Escenarios suelen tener 2 fases cada uno; el diseño queda abierto a que contenido futuro tenga más fases sin rediseñar el sistema — la fase es la clave, no el conteo. Sustituye a la mención sin definir de "checkpoints de fase/Trama/objetivo/secuaz" del GDD v2 §4.3/6.1.bis.
- **Piso del valor de Núcleo: permitir 0 como debuff extremo.** Un modificador (carta/habilidad/pasivo/escenario) puede fijar un Núcleo a 0. Una habilidad pagada con ese Núcleo sigue consumiéndolo y sigue gastando la acción, pero su componente numérico (daño, Trama, etc.) resuelve a 0. *Por qué:* decisión explícita del Director Creativo de permitir debuffs de rango extremos como herramienta de diseño, en contra de la alternativa de piso fijo en 1.

## 2026-07-06 — Cierre de dudas de alcance de la Épica E2 (Director Creativo)

Resuelven las 4 ambigüedades que Coordinator señaló al desglosar la Épica E2 (vertical slice con Phaser) en backlog.md, tras el cierre completo del Hito 1 (motor de combate, 361 tests, 97% cobertura).

- **Contenido visual de H2.8-H2.9: reutilizar el 2×2×2 de H1.** Mismo contenido de juguete ya validado (2 Líderes, 2 Enemigos, 2 Escenarios, 26 cartas), sin crear contenido nuevo para este hito. *Por qué:* coste mínimo, valida el flujo visual sin gastar tiempo en más contenido todavía; ampliar el catálogo es tarea de una épica de contenido posterior, no del vertical slice técnico.
- **H2.15 (PWA) se mantiene dentro de H2, no se difiere a H3.** *Por qué:* decisions.md ya fija "móvil primero" como prioridad explícita; probar el vertical slice en condiciones reales de móvil desde el principio evita descubrir tarde problemas de instalabilidad/rendimiento táctil.
- **Audio de H2.13: stub/tonos genéricos para este MVP, no audio real.** Usar `tone()` de Phaser o placeholders royalty-free; el arte de sonido real se hace en una iteración posterior, cuando el feel visual ya esté validado.
- **Recetas de juice (H2.5): 4 recetas base (diceRoll, cardFlip, hitImpact, screenShake), sin historia separada para particleBurst/hitStop.** Ambos efectos quedan embebidos (particleBurst dentro de diceRoll, hitStop opcional dentro de hitImpact) en vez de ser historias independientes. *Por qué:* menos historias que gestionar para el mismo resultado visual inicial; se pueden separar más adelante si el feel lo pide.

## 2026-07-06 — H2.7 InputAdapter: re-secuenciación de alcance (Architect)

`architecture_stack.md` §4.3 y el texto literal de H2.7 en backlog.md describían un InputAdapter que emite `PlayerIntent` de dominio (ej. `SELECT_CARD`, `CONFIRM_TARGET`), pero eso asume sprites reales de tablero/Núcleos/cartas que todavía no existen — son de H2.8 ("Renderización de tablero, Núcleos, cartas"), la historia siguiente.

- **H2.7 se redefine como clasificación genérica de gestos (tap/drag/long-press → `PointerGesture`), sin traducir todavía a `PlayerIntent` de dominio.** La traducción final a intents semánticos del juego (qué significa "tocar este objeto" en términos de Núcleos/cartas/habilidades) queda diferida a H2.8/H2.9, cuando ya existan sprites reales con `targetId` que interpretar.
- *Por qué:* implementar la semántica de dominio ahora sería inventar sobre objetos que no existen; la capa de gestos (con qué umbrales de tiempo/distancia se distingue un tap de un drag o un long-press) es genuinamente independiente de qué signifique cada gesto en el juego, y puede construirse y testearse en aislamiento sin bloquear el resto de la Épica E2.

## 2026-07-06 — H2.10 "Cooldowns visuales": re-secuenciación de alcance (Architect)

El título de H2.10 en backlog.md ("Cooldowns visuales (CD en cartas)") es una imprecisión heredada: el motor de dominio (`packages/domain/combat/src/types/cooldown.ts`/`config.ts`) solo modela cooldown sobre `AbilityId`+`side` (habilidades de Líder/Enemigo) — las cartas de la mano NUNCA tienen cooldown propio, solo coste de Energía (ya atenuado visualmente desde H2.8).

- **H2.10 se redefine como mejora de la representación visual de los cooldowns de HABILIDADES** (Líder y Enemigo), que ya se mostraban como texto plano en `role-view.ts` desde H2.8 — no se inventa ningún cooldown de carta que no existe en el dominio.
- *Por qué:* el nombre de la historia asumía un concepto (CD de carta) que el motor de reglas nunca implementó (decisión ya cerrada desde H1: el CD pertenece a la habilidad, no a la carta que la activa). Redirigir el esfuerzo a lo que sí existe evita trabajo especulativo y mantiene la historia útil (mejorar el "feel" de un dato ya real, en vez de construir uno ficticio).

## 2026-07-08 — Cierre de dudas de jugabilidad tras probar el vertical slice de combate (Director Creativo + Game Designer)

Resuelven las 3 dudas de diseño que bloqueaban conectar el input táctil de habilidades (H2.7 dejó `ACTIVATE_ABILITY` explícitamente fuera de alcance) y que el Director Creativo detectó jugando la Épica E2 ya desplegada: el clic de habilidad no hace nada, la Energía nunca sube, y el pool de Núcleos se sintió arbitrario.

- **Activar una habilidad NO tiene coste adicional de diseño más allá de lo que el motor ya exige hoy — se confirma, no se corrige.** El coste real y completo de `ACTIVATE_ABILITY` es: (1) gastar 1 de las 2 acciones del turno, (2) la habilidad debe estar con cooldown en 0, (3) consumir un Núcleo del pool cuyo color satisfaga el requisito de la habilidad (o cualquiera si es Neutra), y (4) no haberla activado ya en este mismo turno. No paga Energía — eso ya quedó cerrado el 2026-07-05 ("Coste de Energía de las habilidades: por norma, NO tienen coste de Energía asociado"). *Por qué:* el motor (`combat-engine.ts` `handleActivateAbility`) ya implementa exactamente esta regla; el botón no responde porque H2.7 nunca cableó el gesto de tap al comando, no porque falte una regla de diseño. Se traslada a Architect/Programmer como trabajo de cableado puro, sin nueva decisión de balance que resolver antes.

- **Generar Energía es una acción explícita del jugador que consume 1 de las 2 acciones del turno — no es regeneración automática.** El jugador elige, en su turno, entre jugar una carta/activar una habilidad o "pasar" esa acción para generar +1 Energía (tope 5), igual que ya describía el GDD §2.2 pero que nunca se implementó como comando. *Por qué:* el ritmo de turnos ya fijado (2 acciones alternas, GDD §2.1) solo genera decisiones interesantes si cada acción compite por el mismo recurso escaso. Regenerar Energía gratis (automático al inicio de turno o ligado a otro trigger pasivo) elimina esa competencia y banaliza el recurso — el jugador nunca tendría que sacrificar tempo por músculo futuro. Con Generar Energía como acción, "atacar ya" contra "banco Energía para una carta más fuerte/Contratiempo más adelante" se vuelve una decisión de ritmo real, coherente con la escasez que ya define Núcleos y acciones. Energía inicial sigue en 1 (decisión ya cerrada); el máximo sigue en 5.

- **Pool de Núcleos: tamaño final 8 (sube de 6), reparto sigue siendo azar puro sin cobertura garantizada de color.** Se sube `DEFAULT_NUCLEO_POOL_SIZE` de 6 a 8 fichas por relanzado; se mantiene explícitamente el reparto independiente por ficha (mismo color puede repetirse, ningún color garantizado) ya modelado en H1.3 §0.4. *Por qué:* el caos de color es intencional, no un bug — es la razón de ser de las habilidades de coste Neutro ("para que ningún color de dado quede sin uso", decisión ya cerrada el 2026-07-05); garantizar 1-de-cada-color quitaría sentido a esa mecánica y a la identidad del color CAOS. Lo que sí se ajusta es el volumen: con solo 6 fichas para 5 colores, el caso que vivió el Director (6 fichas, 3 colores) es demasiado frecuente y se lee como injusto en vez de caótico. Subir a 8 reduce la frecuencia de rachas de poca variedad sin eliminar la posibilidad (sigue siendo azar puro), y da más fichas por ciclo de relanzado para que ambos lados (Líder/Enemigo, 2 acciones cada uno) tengan más oportunidades reales de encontrar su color antes del vaciado. Queda abierto a re-tunear en balanceo de contenido real (H1.9+), pero deja de ser un placeholder sin cerrar — Architect/Programmer pueden fijar `DEFAULT_NUCLEO_POOL_SIZE = 8` como valor de diseño confirmado.
  - **⚠️ Sustituida por completo el 2026-07-08** (ver sección "Cierre del loop jugable de batalla" más abajo): el pool de fichas homogéneas de tamaño 8 desaparece. Se sustituye por 5 dados fijos en mesa, uno por color, que se re-tiran (no se relanzan como fichas nuevas) cuando se vacía el último dado disponible.

## 2026-07-08 — Cierre del loop jugable de batalla (Director Creativo + Director del Estudio)

Formaliza en memoria el loop completo de una batalla de combate (fuera de la run/sobres), cerrado en conversación entre el Director Creativo y el Director del Estudio. Sustituye y matiza varias piezas previas de este documento y del glosario, detalladas punto por punto abajo. Nunca se borra texto antiguo — se marca como sustituido/matizado donde corresponde.

### Núcleos: de pool de 8 fichas homogéneas a 5 dados fijos por color
- **⚠️ Sustituye por completo** la decisión "Pool de Núcleos: tamaño final 8" del 2026-07-08 (arriba) y el término "Pool de Núcleos" del glosario.
- **Qué:** ya no hay 8 fichas de un pool homogéneo. En mesa hay **5 dados fijos, uno por cada uno de los 5 colores**, cada uno mostrando un valor 1-4 tras tirarse.
- **Neutro deja de ser un color de dado:** es una etiqueta de coste en las habilidades que acepta el pago con cualquiera de los 5 dados de color presentes en mesa.
- **Dados extra:** cartas o equipo pueden añadir a la mesa dados EXTRA de un color concreto (ej. un Aliado añade un núcleo rojo extra → quedarían 2 rojos + 1 de cada otro color = 6 dados en mesa). Hay un tope duro de dados simultáneos en mesa (valor de diseño sugerido: **10**, a confirmar en balanceo).
- **Reroll:** los dados se gastan según los usa cualquiera de los dos lados (jugador o Enemigo) del pool compartido. En cuanto se gasta el ÚLTIMO dado disponible en mesa (sin importar de quién sea el turno ni quién lo gastó), se re-tiran TODOS los dados en mesa a la vez. Se mantiene sin cambios la regla ya cerrada el 2026-07-05: quien tenga turno inmediatamente después del vaciado elige/actúa primero.
- **Por qué:** un número fijo de dados por color (en vez de fichas sueltas homogéneas repartidas al azar) hace que "quitarle un color al rival" sea una decisión táctica legible — en todo momento se sabe exactamente qué colores hay en mesa y ambos lados compiten explícitamente por ellos, en vez de depender de qué colores tocaron al azar en el relanzado.

### Estructura del turno del jugador: paso previo gratis + 2 acciones
- **Qué (nueva decisión, no existía formalizada antes):**
  1. **Paso previo, gratis, no gasta ninguna de las 2 acciones del turno:** el jugador elige entre **robar 1 carta** (tope de mano: 7) o **ganar 1 Energía** (tope 5). Ambas opciones son mutuamente excluyentes entre sí en este paso. Si ya está al tope de la opción elegida, no ocurre nada (no se pierde el paso, simplemente no tiene efecto).
  2. **Luego, 2 acciones**, cada una elegida libremente entre 4 opciones:
     - (a) **Jugar Carta** (paga Energía).
     - (b) **Generar Energía** (+1 Energía, tope 5 — mismo efecto que la opción gratuita del paso previo, pero aquí cuesta 1 acción).
     - (c) **Robar Carta** (+1 carta, tope mano 7 — mismo efecto que la opción gratuita del paso previo, pero aquí cuesta 1 acción).
     - (d) **Activar Habilidad** (gasta 1 dado de Núcleo cuyo color case con el coste de la habilidad, o cualquiera si el coste es Neutro; requiere cooldown en 0; no paga Energía — esto ya estaba cerrado el 2026-07-05; el valor del dado gastado alimenta la fórmula del efecto vía Umbral, igual que ya estaba cerrado el 2026-07-05).
  - Mano inicial de combate: 5 cartas. Tope de mano: 7.
- **Por qué:** separar "generar recurso" (robar/energía) de "gastar recurso" (jugar carta/activar habilidad) en dos capas —una gratis y una que compite por las 2 acciones— da más granularidad de ritmo: el jugador puede generar recurso gratis Y aun así usar sus 2 acciones en cosas más potentes, o sacrificar una acción para generar más recurso del que la capa gratuita ya le dio.
- **Nota:** esto reafirma y detalla, sin contradecir, la decisión del 2026-07-08 anterior sobre "Generar Energía es una acción explícita del jugador que consume 1 de las 2 acciones" — ahora queda explícito que ese mismo efecto (+1 Energía / +1 carta) también existe en versión gratuita en el paso previo del turno, y que no hay diferencia de efecto entre ambas versiones, solo de coste (punto 7 abajo).

### Ejemplo canónico de resolución de habilidad con Umbral
- **Qué:** dos ejemplos concretos que aclaran, sin cambiarla, la mecánica de Umbral ya cerrada el 2026-07-05 ("el valor del Núcleo alimenta la fórmula vía Umbral"):
  - "Ataque +1 (Neutro)": el jugador puede pagar con cualquier dado en mesa; si usa el dado morado que muestra 4, el ataque hace 4+1=5 de daño.
  - "Trama x2 (Rojo)": el jugador debe pagar específicamente con el dado rojo; si el dado rojo muestra 1, la Trama se reduce en 1×2=2.

### Secuaces del Enemigo: comportamiento en Dramaturgia, no selección aleatoria del motor
- **⚠️ Sustituye parcialmente** la decisión previa de comportamiento de Secuaces. Afecta también a `backlog.md` H1.16, que el Coordinator reabrirá por separado.
- **Qué:** qué Secuaz actúa NO es una selección aleatoria del motor entre los válidos. El comportamiento está escrito en el TEXTO de la carta de Dramaturgia que juega el Enemigo ese turno — ej. una carta puede decir "Tus secuaces atacan" (todos actúan) o "Ataca el secuaz con más vida" (selección determinista por criterio). El azar, si existe, vive en qué carta de Dramaturgia sale, no en una tirada adicional del motor sobre los Secuaces.
- **Por qué:** mantiene el control del balance en el contenido (cartas) en vez de en una regla genérica del motor, permitiendo que cada Enemigo tenga personalidad táctica distinta en cómo usa a sus Secuaces.

### Auto-cura entre combates: fórmula aditiva confirmada con ejemplo numérico
- **Matiza (no sustituye)** la decisión ya cerrada el 2026-07-05 "Auto-recuperación del 50% de vida máxima, para todos, siempre".
- **Qué:** la cura es ADITIVA de +50% de vida máxima, con tope en el máximo — no es un "suelo" que garantice llegar al 50%. Ejemplo: si terminas un combate al 70% de vida, +50% te lleva a 120%, pero el tope lo deja en 100%. Si terminas al 30%, +50% te lleva al 80% (sin tope, se queda en 80%).
- **Por qué:** cierra la ambigüedad de lectura de la fórmula original con un ejemplo numérico explícito, sin cambiar la decisión de fondo.

### Condiciones de victoria/derrota alternativas por Enemigo/Escenario
- **Qué (nueva decisión):** por defecto se mantiene sin cambios lo ya cerrado — derrotar al Enemigo (vida a 0) antes de que la vida del Líder llegue a 0 o la Trama del Escenario llegue a su umbral final. Se añade: un Enemigo o Escenario concreto puede definir condiciones de victoria/derrota alternativas o adicionales a las por defecto. Estas reglas alternativas viven como datos propios en `EnemyDefinition`/`ScenarioDefinition` del catálogo — NO en cartas de Dramaturgia genéricas (a diferencia del comportamiento de Secuaces de arriba, que sí vive en Dramaturgia).
- **Por qué:** permite Enemigos/Escenarios con identidad mecánica propia (ej. una condición de derrota especial ligada a su fantasía) sin tocar el motor genérico ni contaminar las cartas de Dramaturgia compartidas.

### Robar carta y Generar Energía como acción pagada: mismo efecto que la versión gratuita
- **Qué:** tanto "Robar Carta" como "Generar Energía" al usarse como una de las 2 acciones pagadas del turno tienen exactamente el mismo efecto que la versión gratuita del paso previo (+1 carta / +1 Energía, mismos topes 7 y 5). No hay ninguna diferencia de efecto entre la versión gratis y la versión que cuesta acción — la única diferencia es el coste (ninguno vs. 1 acción).
- **Por qué:** evita duplicar reglas o inventar una segunda fórmula de recurso; la única palanca de diseño es cuánto cuesta acceder al mismo efecto, no el efecto en sí.
