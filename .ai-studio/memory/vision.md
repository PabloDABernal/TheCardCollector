# Vision

## ¿Qué estamos construyendo?

**The Collector**: un juego de cartas digital PVE con estructura roguelite. Encarnas a un coleccionista de TCGs reales (MTG, Star Wars Destiny, One Piece TCG, Marvel Champions…) que adapta sus cartas favoritas para inventarse su propio juego en solitario. Cada run: eliges Líder, mazo y un pool de 3 Enemigos + 3 Escenarios; el juego sortea los cruces, tú decides el orden de escalada (N1→N3) y peleas batallas asimétricas de 15-30 minutos contra un mazo de Dramaturgia que juega solo. Móvil primero, testeable en navegador.

## ¿Por qué existe?

Nadie ha juntado estas piezas: escenarios PVE asimétricos (Marvel Champions) + azar compartido y controlable (Star Wars Destiny) + progresión roguelite dentro de la batalla (Slay the Spire) + meta-juego de colección TCG entre runs. La palanca diferencial es el medio digital: dados virtuales de rango modificable, cooldowns automáticos y counters diferidos (Contratiempo) que en mesa serían un engorro, aquí son un número en memoria. Es un proyecto just for fun: sin monetización, todo se gana jugando.

## ¿Qué experiencia queremos crear?

- **La fantasía del coleccionista:** abrir sobres, completar la matriz Enemigo×Escenario×Nivel, construir mazos en tu habitación llena de cajas, con cartas que parecen adaptaciones caseras (tachones, notas manuscritas, sello "Collector's Edition"). Cruzar universos es la gracia, no un accidente.
- **Tensión táctica compartida:** el pool de Núcleos es de los dos; cada gasto tuyo es información y negación para el rival.
- **Roguelite puro con decisiones densas:** perder termina la run; la dificultad se mide en tiempo de decisión, nunca en esponjas de vida (tope duro: 100 HP por enemigo). Nunca hay acción muerta, nunca hay turno vacío.

## Experiencia objetivo del combate rediseñado (2026-07-12)

Tras jugar el build de H4, el Director Creativo dio un feedback textual: *"sigue sin parecer un prototipo, necesito más chicha"* — el combate se siente lento/confuso y plano, y pidió explícitamente *"no necesito cambios pequeños. cambio profundo y que luego vea un juego diferente"*. Esta sección fija la experiencia objetivo que debe perseguir el rediseño. **Es 100% capa de experiencia/UX: ninguna regla de Núcleos, turno, cooldowns, Umbral o Trama cambia.** Lo que cambia es cómo se presenta, se secuencia y se pondera visualmente lo que el motor ya hace.

Tres ideas actúan juntas, no como parches independientes:

### 1. La mesa de dados es el centro visual permanente del combate
Los 5 Núcleos (dados por color) dejan de ser un panel más del HUD y pasan a ocupar el centro real de la pantalla, siempre visibles, siempre en foco — como una mesa física de verdad (referencia ya citada en decisions.md: forcetable.net/strawtable.net). Es la pieza que ya es el corazón táctico del sistema ("quitarle un color al rival" es la tensión central por diseño), así que debe ser también el centro de atención del jugador en todo momento, no algo que hay que ir a mirar a un lateral. Toda acción que consuma o afecte a un dado se lee como algo que ocurre físicamente en esa mesa.

### 2. El turno se responde una pregunta a la vez, no se lee de golpe
En vez de exponer simultáneamente las 4 opciones de acción (jugar carta / generar energía / robar carta / activar habilidad) con todas sus sub-opciones (qué carta, qué dado, qué objetivo) desde el primer instante, el turno se presenta como una secuencia: primero "¿qué quieres hacer?", y solo tras responder eso se revela el detalle necesario para esa elección concreta. El jugador nunca tiene que leer todo el tablero antes de poder decidir algo — decide el tipo de jugada primero, afina después. Esto no cambia el paso previo gratis ni las 2 acciones pagadas; cambia el orden en que se entrega la información.

### 3. No todo pesa igual: momentos grandes vs. momentos rutinarios
El turno tiene una jerarquía de importancia deliberada. Lo rutinario se resuelve rápido y sin ceremonia; los momentos que ya son mecánicamente decisivos se tratan como el punto álgido del turno, con foco total de pantalla dedicado solo a ellos.

**Momentos "grandes" (foco total, el resto del juego se detiene para dejarlos respirar):**
- Activar una habilidad (de Líder, Aliado o Enemigo).
- Cambio de fase del Enemigo o del Escenario.
- Muerte de un Secuaz (propio o del Enemigo).
- Un valor de Umbral que cruza un límite crítico (ej. Trama llega a su siguiente umbral, vida de un Secuaz/Enemigo cruza un porcentaje relevante).

**Momentos "rutinarios" (rápidos, casi invisibles, sin ceremonia):**
- Generar Energía (gratis o pagada).
- Robar Carta (gratis o pagada).
- Cualquier otra resolución que no cruce uno de los cuatro puntos de inflexión de arriba.

El contraste es la herramienta de diseño: si todo se anima con el mismo peso, nada se siente importante. Reservar la "cámara"/foco solo para los 3-4 momentos que de verdad importan es lo que hace que esos momentos se sientan grandes — y que lo rutinario, precisamente por ser rápido, no estorbe el ritmo.

### Cómo se siente jugar un turno completo, de principio a fin
La pantalla se abre con la mesa de 5 dados en el centro, siempre visible, mostrando sus valores actuales. Llega el turno del jugador: primero, una única pregunta simple — robar carta o ganar energía (paso previo gratis) — se resuelve al instante, sin ceremonia, casi como un gesto reflejo. Después, el juego pregunta "¿qué quieres hacer?" para la primera de las 2 acciones; el jugador ve solo las 4 categorías, elige una (por ejemplo, activar una habilidad), y solo entonces se revela el detalle: qué habilidad, qué dado de la mesa la paga. En el instante en que el jugador confirma, la cámara se dedica por completo a ese gesto — el dado elegido se destaca en la mesa, la habilidad se resuelve con todo el peso visual disponible, porque es un momento que importa. Si esa habilidad remata a un Secuaz o hace que la Trama cruce un umbral, el foco se extiende: ese es el clímax del turno, y el juego se toma el tiempo de mostrarlo. La segunda acción, si es simplemente generar energía, se resuelve en cambio en un parpadeo — sin preguntas largas, sin cámara dedicada, porque no es un punto de inflexión. El turno pasa al Enemigo, y el mismo contraste rutinario/grande se aplica a su IA: sus acciones de trámite pasan rápido, pero un cambio de fase suyo recibe el mismo tratamiento de foco total que recibiría el jugador. La mesa de dados, entretanto, nunca deja de estar ahí, en el centro, contando su propia historia de qué colores quedan y quién los está agotando.

**Qué NO es esto:** no es una lista de efectos de partículas ni de animaciones concretas (eso lo decide Architect/Programmer al implementar); no es un rediseño de las reglas de combate (Núcleos, turno con paso previo + 2 acciones, cooldowns, Umbral, Trama siguen exactamente como están cerrados en decisions.md); es la especificación de diseño de qué debe sentir el jugador y en qué orden debe recibir la información, para que la capa de "juice" que se construya después tenga un ritmo real que amplificar en vez de un ritmo plano que solo suene más fuerte.
